import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';
import { buildPage, toOffsetLimit } from '@/lib/shared/pagination';

import { DuplicateOrderRecipeError } from '../../../domain/errors';
import {
  ORDER_PRIORITY_VALUES,
  ORDER_STATUS_VALUES,
  type OrderLineStatus,
  type OrderPriority,
  type OrderStatus,
} from '../../../domain/order-classification';
import {
  ORDER_CUSTOMER_FILTER_FIELD,
  ORDER_CUSTOMER_PRESENCE_FILTER_FIELD,
  ORDER_CUSTOMER_PRESENCE_NONE,
} from '../../../domain/order-customer';
import { deriveOrderStatus } from '../../../domain/order-status-derivation';

import { companyScopeColumns, orderCompanyScope } from './company-scope';
import { dateRangeCondition, numberRangeCondition, selectCondition } from './list-query-sql';

import type { ListFilterValue, ListQuery, ListSort } from '../../../domain/list-query';
import type { Page } from '../../../domain/page';
import type { StoredOrderCost } from '../../../domain/order-cost';
import type { OrderScope } from '../../../domain/order-scope';
import type {
  NewOrder,
  OrderHeaderEdit,
  OrderLineRow,
  OrderPresentationLineRow,
  OrderPresentationLineWrite,
  OrderRow,
} from '../../../domain/order-view';
import type {
  FinishPackingLine,
  LineStageStamp,
  LockedOrderLine,
  LockedOrderLines,
  LockedOrderRow,
  NewOrderLine,
  OrderLineChanges,
  OrderLineEditWrite,
  OrderLineWrite,
  OrderWriteRepository,
  RecordedPackedLine,
} from '../../../ports/order-write-repository';
import type { BlockedOrderLineRef } from '../../../ports/order-repository';
import type { OrderConditioningRepository } from '../../../ports/order-conditioning-repository';
import type { OrderPackingRepository } from '../../../ports/order-packing-repository';

/** Cliente global o el transaccional que abra quien llama: los metodos de mas abajo no
 *  distinguen, mismo patron que `createOrderAssignmentRepository`. */
type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Implementa `OrderRepository` (`ports/order-repository.ts`, `design.md > 4.2`, `> 7.4`,
 * `> 10`) con Prisma. UNICO archivo del modulo `pedidos` que importa `@prisma/client`,
 * `@/lib/shared/db/prisma` y `@/lib/shared/pagination` (R52, R53).
 *
 * NO HAY NI UN `include` NI UN `select` hacia `recipes` ni `users` (R53, QC-33 R31/R32): el
 * nombre de la receta lo resuelve el caso de uso por el contrato publico de `recetas`, y los dos
 * autores viajan como IDENTIFICADORES en crudo (R46). Por eso QC-33 dejo las FK como escalares
 * sin `@relation`: aqui no hay relacion que navegar ni por descuido.
 *
 * `orders` solo guarda la cabecera del pedido. Lo de cada receta -receta, cantidad, unidad,
 * costes, precio, reserva y etapas- se lee y se escribe en `order_lines`.
 *
 * `deleted_at IS NULL` va en el `where` de TODA lectura y de TODA escritura `…Alive`, nunca
 * en un `if` posterior (R40): el filtro es del puerto, y por eso ningun caso de uso puede
 * olvidarlo.
 *
 * La cantidad viaja como CADENA decimal por el puerto -el dominio no puede importar
 * `Prisma.Decimal` (`docs/architecture.md > Anti-patrones`)-: `toDecimalInput` y
 * `fromDecimal` son el UNICO sitio del modulo que convierte en los dos sentidos, y a la
 * salida siempre con `.toFixed(4)`, que es la escala de la columna `Decimal(14, 4)`.
 *
 * Los SQLSTATE NO cruzan hacia el dominio (R56, `design.md > 7.4`): se traducen a resultados
 * DISCRIMINADOS. Lo que no se sabe traducir se RELANZA: aqui no hay ni un `catch` vacio.
 */

/** `select` unico de las dos lecturas. `deleted_at` NO sale: ninguna consulta devuelve
 *  borrados (R40), asi que seria siempre `null` e invitaria a filtrar en memoria lo que ya
 *  filtro el `where`. */
const ORDER_SELECT = {
  id: true,
  orderYear: true,
  orderSequence: true,
  priority: true,
  status: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  customerId: true,
} satisfies Prisma.OrderSelect;

type OrderPrismaRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

/** Cadena decimal(14,4) del puerto -> `Prisma.Decimal` para escribir. */
export function toDecimalInput(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Las dos columnas del importe van siempre juntas: el CHECK
 *  `order_lines_packaging_cost_matches_ingredients_cost` rechaza una sin la otra. */
function costColumns(cost: StoredOrderCost | null): {
  ingredientsCost: Prisma.Decimal | null;
  packagingCost: Prisma.Decimal | null;
} {
  if (cost === null) return { ingredientsCost: null, packagingCost: null };
  return { ingredientsCost: toDecimalInput(cost.total), packagingCost: toDecimalInput(cost.packaging) };
}

/** `Prisma.Decimal` de una lectura -> cadena con la escala EXACTA de la columna. */
export function fromDecimal(value: Prisma.Decimal): string {
  return value.toFixed(4);
}

/** Fila de Prisma -> `OrderRow` del puerto. Sin ninguna traduccion de negocio: el
 *  correlativo se agrupa en `number` porque el ano y la posicion son UN solo dato
 *  (`domain/order-number.ts`), y el texto visible lo compone el dominio (R14). */
export function toOrderRow(row: OrderPrismaRow): OrderRow {
  return {
    id: row.id,
    number: { year: row.orderYear, sequence: row.orderSequence },
    priority: row.priority,
    status: row.status,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    customerId: row.customerId,
  };
}

/**
 * SQLSTATE de un error de Postgres, leido del campo ESTRUCTURADO del conector y jamas del texto
 * del mensaje: en esta maquina Postgres responde en espanol y el detalle del choque ni siquiera
 * nombra la restriccion. Un `$queryRaw` que viola una restriccion llega como
 * `PrismaClientKnownRequestError` con `code: 'P2010'` y el SQLSTATE en `meta.code`.
 */
function sqlStateOf(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  const meta: unknown = error.meta;
  if (typeof meta !== 'object' || meta === null || !('code' in meta)) return null;
  const code: unknown = (meta as { code: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Duplicado del correlativo: SQLSTATE `23505`, sin leer texto. Es seguro solo porque se usa acotado
 *  al `INSERT` de `insertAliveOrder`, que no escribe `id` (lo genera `gen_random_uuid()`): de los
 *  unicos de `orders` solo puede chocar `orders_company_year_sequence_key`. */
export function isDuplicateOrderNumber(error: unknown): boolean {
  return sqlStateOf(error) === '23505';
}

/** Lo que devuelve el `RETURNING` del alta: el identificador y el correlativo que acaba de
 *  calcular el propio `INSERT`, `max(order_sequence) + 1` de esa empresa y ese ano bajo el lock
 *  de aviso. Nada mas viaja de vuelta, porque nada mas lo decide la base. */
type CreatedOrderRow = {
  readonly id: string;
  readonly order_year: number;
  readonly order_sequence: number;
};

/** Lock de DOS enteros: es otro espacio de claves que el `pg_advisory_lock(bigint)` de
 *  `tests/helpers/test-database.ts`, asi que no pueden colisionar. */
const ORDER_SEQUENCE_LOCK_NAMESPACE = 60;

/** La EMPRESA y el ANO van en la clave del lock: dos empresas —o dos anos— no se hacen cola entre
 *  si. */
const ORDER_SEQUENCE_LOCK_KEY_PREFIX = 'orders_sequence:';

/** Tres intentos y ni uno mas. El lock hace que el choque sea casi
 *  imposible; el indice unico es la garantia. Reintentar sin techo convertiria un duplicado real
 *  —por ejemplo el que insertara otra via— en un bucle infinito. Exportada porque
 *  `withOrderTransaction` reintenta con el mismo tope. */
export const CREATE_ORDER_MAX_ATTEMPTS = 3;

/** `findAliveById`: `deleted_at IS NULL` Y EL AMBITO en el `where`, no en un `if` posterior. Un
 *  pedido de otra empresa vuelve como `null`, igual que uno que no existe. Un pedido CANCELADO si
 *  vuelve -tiene estado propio precisamente para no desaparecer-. */
export async function findAliveOrderById(
  id: string,
  scope: OrderScope,
): Promise<OrderRow | null> {
  const row = await prisma.order.findFirst({
    where: { AND: [orderCompanyScope(scope), { id, deletedAt: null }] },
    select: ORDER_SELECT,
  });
  return row === null ? null : toOrderRow(row);
}

/**
 * `listAlive` (R34-R41).
 *
 * PAGINACION: `toOffsetLimit`/`buildPage` de `lib/shared/pagination` se llaman AQUI (R37,
 * `design.md > 10`), porque `domain/` no puede importar `lib/shared/**
 * Desempate ESTABLE por identificador (R10). El orden de hoy ya era total gracias al
 * correlativo, pero un orden pedido por el contrato -por `status`, por `quantity`- empata sin
 * remedio: sin este ultimo criterio dos filas empatadas pueden intercambiarse -o perderse-
 * entre paginas, porque el orden de las empatadas no esta definido.
 */
const TIE_BREAKER = { id: 'asc' } as const satisfies Prisma.OrderOrderByWithRelationInput;

/**
 * Orden POR DEFECTO: `priority DESC, created_at DESC, order_year DESC,
 * order_sequence DESC, id ASC`. La prioridad manda y, dentro de cada prioridad, los
 * mas nuevos primero; el correlativo desempata dos altas del mismo instante (el mas alto es el
 * ultimo creado) y el `id` deja el orden total.
 *
 * `priority DESC` da `CRITICA -> ALTA -> MEDIA -> BAJA` porque Postgres ordena un enum por su
 * ORDEN DE DECLARACION, que QC-33 R16 fijo de menor a mayor -por eso reordenar esas cuatro
 * lineas del enum cambiaria el listado, y el test estatico de QC-33 lo vigila-. **No es orden
 * alfabetico**: alfabeticamente `ALTA` iria antes que `MEDIA`, y de mayor a menor la lista
 * empezaria por `MEDIA` en vez de por `CRITICA`.
 *
 * Se construye en CADA llamada, no como constante compartida: Prisma exige un array mutable en
 * `orderBy`, y devolver siempre la misma instancia dejaria que un llamante la mutara para todos.
 */
function defaultOrderBy(): Prisma.OrderOrderByWithRelationInput[] {
  return [
    { priority: 'desc' },
    { createdAt: 'desc' },
    { orderYear: 'desc' },
    { orderSequence: 'desc' },
    TIE_BREAKER,
  ];
}

/**
 * `sort` del contrato -> `orderBy` de Prisma (R10, R11).
 *
 * DOS COSAS QUE NO SON OBVIAS:
 *
 *   1. **`orderNumber` es la UNICA traduccion uno-a-dos del contrato** (`design.md > 5`): el
 *      numero visible NO esta guardado -lo compone `formatOrderNumber`-, es el par
 *      `(order_year, order_sequence)`. Se presenta como UN campo ordenable y aqui se traduce a
 *      DOS criterios, el ano primero. Ordenar por el texto compuesto seria ordenar
 *      alfabeticamente, y `2026-0000010` iria antes que `2026-0000009`... solo mientras los
 *      correlativos tengan el mismo numero de digitos; el par de enteros no tiene ese problema.
 *   2. **`priority` y `status` ordenan por el ORDEN DE DECLARACION del enum**, no por el
 *      alfabetico, porque son enums de Postgres. En `priority` ese orden ES el de la prioridad
 *      (QC-33 R16) y por eso es el que se quiere; esta escrito en `db/schema.prisma` y no se
 *      toca.
 *
 * Ninguna columna ordenable de `ORDER_QUERYABLE` es anulable, asi que aqui no hace falta
 * `nulls: 'last'`.
 *
 * `quantity` no esta aqui: es de la linea y Prisma no ordena por un campo de una relacion a
 * muchos. La ordena `listAliveOrders` con `orderIdsByFirstLineQuantity`.
 *
 * El `default` NO puede darse por inalcanzable: `sanitizeListQuery` ya poda lo que no esta
 * declarado, pero el adaptador no puede depender de que su llamante lo haya hecho. Es defensa
 * en profundidad, y mantiene R5 cierto tambien aqui.
 */
export function orderOrderBy(sort: ListSort | null): Prisma.OrderOrderByWithRelationInput[] {
  if (sort === null) return defaultOrderBy();
  const dir = sort.direction;

  switch (sort.columnId) {
    case 'orderNumber':
      return [{ orderYear: dir }, { orderSequence: dir }, TIE_BREAKER];
    case 'priority':
      return [{ priority: dir }, TIE_BREAKER];
    case 'status':
      return [{ status: dir }, TIE_BREAKER];
    case 'createdAt':
      return [{ createdAt: dir }, TIE_BREAKER];
    // QC-35bis (2026-09-07): `unitPrice` ya no es ordenable -salio de `ORDER_QUERYABLE` y de la
    // tabla-, asi que cae por el `default` como cualquier columna desconocida.
    default:
      return defaultOrderBy();
  }
}

/**
 * `select` del contrato -> `in` del enum correspondiente.
 *
 * El caso de uso ya poda los valores que no estan en el conjunto cerrado (R5, R25), pero el
 * adaptador vuelve a filtrar y no por desconfianza: es lo que le da el TIPO. `selectCondition`
 * devuelve `string[]` y Prisma exige `OrderStatus[]`; sin este filtro habria que mentirle al
 * compilador con un `as`, y un valor que no existe en el enum haria que Postgres rechazara la
 * consulta entera -que es justo lo que R5 prohibe-.
 */
function enumIn<T extends string>(
  values: readonly string[],
  allowed: readonly T[],
): { in: T[] } | null {
  const kept = values.filter((value): value is T => (allowed as readonly string[]).includes(value));
  return kept.length === 0 ? null : { in: kept };
}

/**
 * Rango numerico del contrato -> rango en `Prisma.Decimal` (`design.md > 5`).
 *
 * `quantity` es `DECIMAL(14,4)` y el `numberRange` del contrato emite `number`. La
 * conversion vive AQUI, en el adaptador: `docs/architecture.md > Anti-patrones` prohibe
 * comparar importes en coma flotante binaria, y el dominio ademas no puede importar
 * `@prisma/client`.
 */
function toDecimalRange(
  condition: { gte?: number; lte?: number },
): { gte?: Prisma.Decimal; lte?: Prisma.Decimal } {
  return {
    ...(condition.gte === undefined ? {} : { gte: new Prisma.Decimal(condition.gte) }),
    ...(condition.lte === undefined ? {} : { lte: new Prisma.Decimal(condition.lte) }),
  };
}

/**
 * Un `PARCIAL` sale tambien cuando alguna de sus lineas activas esta en un estado pedido. Las
 * lineas van en un `EXISTS` sobre `orders`, asi que un pedido no sale dos veces y el `count`
 * coincide. Una linea nunca es `PARCIAL`, asi que ese valor solo cuenta en el primer brazo.
 */
function orderStatusFilterWhere(statuses: readonly OrderStatus[]): Prisma.OrderWhereInput {
  const lineStatuses = statuses.filter((status) => status !== 'PARCIAL' && status !== 'CANCELADO');
  if (lineStatuses.length === 0) return { status: { in: [...statuses] } };
  return {
    OR: [
      { status: { in: [...statuses] } },
      { status: 'PARCIAL', lines: { some: { deletedAt: null, status: { in: lineStatuses } } } },
    ],
  };
}

/**
 * Un filtro del contrato -> la condicion de la columna que le corresponde. Devuelve `null` -y
 * el filtro no aparece en el `where`- cuando el campo no es filtrable aqui o cuando el valor no
 * acota nada (rango con los dos extremos nulos, `select` con lista VACIA: no haber elegido nada
 * NO es «ningun resultado», `design.md > 3.3`).
 *
 * Las CUATRO formas del contrato estan contempladas (R12). La de `text` no llega hoy -`orders`
 * no declara ningun campo de texto filtrable y ni siquiera busca (R17)-; se escribe igual
 * porque traducir es trabajo del adaptador y declarar manana un campo de texto no puede
 * depender de que alguien recuerde que aqui faltaba una rama.
 */
function orderFilterWhere(field: string, value: ListFilterValue): Prisma.OrderWhereInput | null {
  switch (value.kind) {
    case 'select': {
      const condition = selectCondition(value.values);
      if (condition === null) return null;
      if (field === 'status') {
        const enumCondition = enumIn<OrderStatus>(condition.in, ORDER_STATUS_VALUES);
        return enumCondition === null ? null : orderStatusFilterWhere(enumCondition.in);
      }
      if (field === 'priority') {
        const enumCondition = enumIn<OrderPriority>(condition.in, ORDER_PRIORITY_VALUES);
        return enumCondition === null ? null : { priority: enumCondition };
      }
      return null;
    }
    case 'numberRange': {
      const condition = numberRangeCondition(value.min, value.max);
      if (condition === null) return null;
      if (field === 'quantity') {
        return { lines: { some: { deletedAt: null, quantity: toDecimalRange(condition) } } };
      }
      if (field === 'orderYear') return { orderYear: condition };
      return null;
    }
    case 'dateRange': {
      const condition = dateRangeCondition(value.from, value.to);
      if (condition === null) return null;
      if (field === 'createdAt') return { createdAt: condition };
      if (field === 'updatedAt') return { updatedAt: condition };
      return null;
    }
    case 'text':
      return null;
  }
}

/**
 * Los dos filtros de cliente -un id o «sin cliente»- en UN solo termino del `AND`. Con los dos a
 * la vez es la union, y el `OR` queda dentro de este termino: suelto al nivel del ambito
 * ampliaria lo visible. `null` = ninguno de los dos acota.
 */
export function orderCustomerFilterWhere(
  customerIdFilter: ListFilterValue | undefined,
  customerPresenceFilter: ListFilterValue | undefined,
): Prisma.OrderWhereInput | null {
  const ids = customerIdFilter?.kind === 'select' ? selectCondition(customerIdFilter.values) : null;
  const none =
    customerPresenceFilter?.kind === 'select' &&
    customerPresenceFilter.values.includes(ORDER_CUSTOMER_PRESENCE_NONE);

  if (ids !== null && none) return { OR: [{ customerId: ids }, { customerId: null }] };
  if (ids !== null) return { customerId: ids };
  if (none) return { customerId: null };
  return null;
}

/**
 * `where` UNICO del listado de pedidos: el mismo objeto para el `findMany` y para el `count`.
 * Tres capas, y ninguna sobra:
 *
 *   1. **`deletedAt: null` SIEMPRE** (R7, R40). NO es un filtro opcional y por eso nunca estuvo
 *      en los parametros del listado: `deletedAt` no es consultable en ninguna lista blanca y
 *      `sanitizeListQuery` lo poda ademas por su cuenta. Los CANCELADOS si salen -tienen estado
 *      propio en vez de desaparecer (R25)-; los borrados no salen nunca.
 *   2. **`recipeIds`**, cuando la busqueda resolvio un termino: acota a los pedidos con alguna
 *      linea viva de esas recetas. `null` significa que no hay busqueda y no acota nada; `[]`
 *      significa que ninguna receta caso y el `IN` vacio deja la pagina sin filas.
 *   3. **Los filtros, TODOS a la vez**: un `AND` explicito, de modo que una fila sale solo
 *      si los cumple todos. Estado y prioridad son dos de ellos (R25), ya no dos parametros.
 */
export function buildOrderWhere(
  query: ListQuery,
  recipeIds: readonly string[] | null,
  scope: OrderScope,
): Prisma.OrderWhereInput {
  const {
    [ORDER_CUSTOMER_FILTER_FIELD]: customerIdFilter,
    [ORDER_CUSTOMER_PRESENCE_FILTER_FIELD]: customerPresenceFilter,
    ...otherFilters
  } = query.filters;
  const customerFilter = orderCustomerFilterWhere(customerIdFilter, customerPresenceFilter);
  const filters = Object.entries(otherFilters)
    .map(([field, value]) => orderFilterWhere(field, value))
    .filter((condition): condition is Prisma.OrderWhereInput => condition !== null);

  // El AMBITO va PRIMERO y en su propio termino del `AND`, al lado de `deletedAt: null` y ANTES de
  // los filtros. NUNCA fundido con ellos ni al mismo nivel que un `OR`: un `OR` y el `companyId` en
  // el mismo objeto dejarian que un filtro AMPLIE lo visible en vez de acotarlo. `recipeIds` va en
  // su PROPIO termino del `AND`, entre el borrado y los filtros, por el mismo motivo.
  return {
    AND: [
      orderCompanyScope(scope),
      { deletedAt: null },
      ...(recipeIds === null ? [] : [{ lines: { some: { deletedAt: null, recipeId: { in: [...recipeIds] } } } }]),
      ...filters,
      ...(customerFilter === null ? [] : [customerFilter]),
    ],
  };
}

/**
 * Los ids de una pagina del listado ordenado por la cantidad de la primera linea viva de cada
 * pedido, la que muestra la pantalla de una receta, con `id` de desempate. El `where` se resuelve
 * con Prisma y el orden y la pagina, en la base: nunca se ordena en memoria.
 */
async function orderIdsByFirstLineQuantity(
  where: Prisma.OrderWhereInput,
  direction: ListSort['direction'],
  offset: number,
  limit: number,
  scope: OrderScope,
): Promise<readonly string[]> {
  const matching = await prisma.order.findMany({ where, select: { id: true } });
  if (matching.length === 0) return [];
  const { companyId } = companyScopeColumns(scope);
  const dir = direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const rows = await prisma.$queryRaw<ReadonlyArray<{ readonly id: string }>>(Prisma.sql`
    SELECT o."id"
      FROM "orders" o
     WHERE o."id" = ANY(${matching.map((row) => row.id)}::uuid[])
       AND o."company_id" = ${companyId}::uuid
     ORDER BY (SELECT l."quantity"
                 FROM "order_lines" l
                WHERE l."order_id" = o."id" AND l."company_id" = ${companyId}::uuid AND l."deleted_at" IS NULL
                ORDER BY l."position"
                LIMIT 1) ${dir},
              o."id" ASC
     OFFSET ${offset}::integer
     LIMIT ${limit}::integer
  `);
  return rows.map((row) => row.id);
}

/**
 * `listAlive` con el CONTRATO GENERICO de consulta (QC-57 R10, R11, R13, R14, R15, R17, R25,
 * R29; QC-34 R34, R38, R40, R41).
 *
 * PAGINACION: `toOffsetLimit`/`buildPage` de `lib/shared/pagination` se llaman AQUI (R37,
 * `design.md > 10`), porque `domain/` no puede importar `lib/shared/**`. El `limit` que llega
 * a Prisma -y el `pageSize` que sale en la `Page`- es el ACOTADO que devuelve `toOffsetLimit`
 * (defecto 10, tope 25, R35, R29), nunca el que pidio el llamante: pasarle el pedido a
 * `buildPage` dejaria un `totalPages` mentiroso aunque el `LIMIT` de SQL fuera correcto. Pedir
 * 100 se ACOTA a 25, no se rechaza.
 *
 * ORDEN Y FILTROS VAN AL MOTOR, nunca a la pagina ya traida (R13): filtrar lo ya descargado es
 * justo lo que QC-22 y QC-26 rechazaron por enganoso, y ademas dejaria un `total` mentiroso.
 *
 * `total` sale de un `count` con el MISMO `where` que el `findMany` (R14) -literalmente la
 * misma constante, no dos copias parecidas-.
 *
 * `recipeIds` es obligatorio, sin valor por defecto: las llamadas que no hablan de busqueda
 * pasan `null` explicito, que significa «sin busqueda, no acotar nada».
 */
export async function listAliveOrders(
  query: ListQuery,
  recipeIds: readonly string[] | null,
  scope: OrderScope,
): Promise<Page<OrderRow>> {
  const { offset, limit } = toOffsetLimit(query.page, query.pageSize);
  const where = buildOrderWhere(query, recipeIds, scope);

  if (query.sort?.columnId === 'quantity') {
    const [ids, total] = await Promise.all([
      orderIdsByFirstLineQuantity(where, query.sort.direction, offset, limit, scope),
      prisma.order.count({ where }),
    ]);
    const rows = await prisma.order.findMany({ where: { id: { in: [...ids] } }, select: ORDER_SELECT });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const page = ids.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [toOrderRow(row)];
    });
    return buildPage(page, total, query.page, limit);
  }

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: ORDER_SELECT,
      orderBy: orderOrderBy(query.sort),
      skip: offset,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return buildPage(rows.map(toOrderRow), total, query.page, limit);
}

/**
 * `updateAlive`: solo la prioridad y el cliente, con el AMBITO en el `where` junto a
 * `deletedAt: null`; un pedido de otra empresa sale como `'not_found'`. Lo de cada receta -y su
 * reparto- lo escribe `writeLines` por linea. `data` no lleva `createdBy` ni `createdAt`, asi que
 * el autor de la creacion no se toca; tampoco estado ni motivo.
 */
export async function updateAliveOrder(
  id: string,
  data: OrderHeaderEdit,
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike = prisma,
): Promise<'ok' | 'not_found'> {
  const { count } = await tx.order.updateMany({
    where: { AND: [orderCompanyScope(scope), { id, deletedAt: null }] },
    data: { priority: data.priority, customerId: data.customerId, updatedAt: now, updatedBy: actorId },
  });
  return count === 1 ? 'ok' : 'not_found';
}

/**
 * `cancelAlive` (R26, R28, R29, R30, R40). UNICO metodo capaz de escribir el estado cancelado
 * y el motivo, y los escribe JUNTOS, en la MISMA sentencia: el `CHECK`
 * `orders_cancellation_reason_matches_status` exige que el motivo exista si y solo si el
 * estado es el cancelado, asi que separarlos en dos escrituras seria imposible por
 * construccion.
 *
 * El motivo llega YA recortado y con el tope de 500 aplicado por `cancelOrderSchema` (R27):
 * aqui no se recorta, no se trunca y no se vuelve a validar nada.
 *
 * El AMBITO viaja EN EL `where`, junto a `deletedAt: null`: un pedido de otra empresa no se
 * cancela y sale como `'not_found'`.
 *
 * `actorId` admite `null`: la caducidad automatica cancela sin que nadie la haya pedido, y
 * `updated_by` es nullable exactamente para eso.
 */
export async function cancelAliveOrder(
  id: string,
  reason: string,
  actorId: string | null,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike = prisma,
): Promise<'ok' | 'not_found'> {
  const { count } = await tx.order.updateMany({
    where: { AND: [orderCompanyScope(scope), { id, deletedAt: null }] },
    data: {
      status: 'CANCELADO',
      cancellationReason: reason,
      updatedAt: now,
      updatedBy: actorId,
    },
  });
  return count === 1 ? 'ok' : 'not_found';
}

/**
 * `softDeleteAlive`. Borrado LOGICO: marca `deleted_at` -y sella `updated_at`/`updated_by`- del
 * pedido y de todas sus lineas vivas, JAMAS `prisma.order.delete`. La fila se conserva entera y su
 * correlativo no se libera ni se reutiliza.
 *
 * Que un pedido entregado o cancelado no se borre lo comprueba el caso de uso (R32) y ademas
 * lo impide el `CHECK orders_delivered_not_deleted` en la base. Ese `23514` NO se traduce a
 * un resultado discriminado a proposito: significa que la comprobacion de aplicacion se
 * salto, y un error sin traducir es exactamente lo que hay que ver en ese caso.
 *
 * El AMBITO viaja EN EL `where`: un pedido de otra empresa no se borra y sale como `'not_found'`.
 */
export async function softDeleteAliveOrder(
  id: string,
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike = prisma,
): Promise<'ok' | 'not_found'> {
  const { count } = await tx.order.updateMany({
    where: { AND: [orderCompanyScope(scope), { id, deletedAt: null }] },
    data: { deletedAt: now, updatedAt: now, updatedBy: actorId },
  });
  if (count !== 1) return 'not_found';
  const { companyId } = companyScopeColumns(scope);
  await tx.orderLine.updateMany({
    where: { orderId: id, companyId, deletedAt: null },
    data: { deletedAt: now, updatedAt: now, updatedBy: actorId },
  });
  return 'ok';
}

/** Fila minima del bloqueo: el identificador para saber que la fila existia, era viva y de esta
 *  empresa; el resto de columnas se relee con la API tipada. */
type LockedOrderIdRow = {
  readonly id: string;
};

/**
 * `lockAliveById` de `OrderWriteRepository`: `SELECT ... FOR UPDATE` de un pedido vivo, con el
 * MISMO filtro que `findAliveOrderById`. Bloqueada la fila, se relee con `findUnique` -ya es de
 * esta transaccion, no hay una segunda espera- para no repetir a mano `ORDER_SELECT`.
 */
async function lockAliveOrderById(
  id: string,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<LockedOrderRow | null> {
  const { companyId } = companyScopeColumns(scope);
  const rows = await tx.$queryRaw<ReadonlyArray<LockedOrderIdRow>>(Prisma.sql`
    SELECT "id"
      FROM "orders"
     WHERE "id" = ${id}::uuid
       AND "company_id" = ${companyId}::uuid
       AND "deleted_at" IS NULL
       FOR UPDATE
  `);
  const alive = rows[0];
  if (alive === undefined) return null;

  const row = await tx.order.findUnique({ where: { id: alive.id }, select: ORDER_SELECT });
  if (row === null) return null;
  return toOrderRow(row);
}

/**
 * `create` de `OrderWriteRepository`: el UNICO `INSERT` de pedido del modulo, con el lock de
 * aviso del correlativo. Corre sobre el cliente que ya abrio `OrderUnitOfWork`, SIN bucle de
 * reintento propio -si el correlativo choca aqui la transaccion entera ya quedo abortada, y
 * quien reintenta con una transaccion NUEVA es `withOrderTransaction`-. El choque se deja SUBIR
 * tal cual, sin traducir.
 */
async function insertAliveOrder(
  tx: PrismaLike,
  data: NewOrder,
  year: number,
  actorId: string,
  now: Date,
  scope: OrderScope,
): Promise<OrderRow> {
  const { companyId } = companyScopeColumns(scope);
  const lockKey = `${ORDER_SEQUENCE_LOCK_KEY_PREFIX}${companyId}:${String(year)}`;

  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(${ORDER_SEQUENCE_LOCK_NAMESPACE}::int, hashtext(${lockKey}::text))`,
  );

  const filas = await tx.$queryRaw<readonly CreatedOrderRow[]>(Prisma.sql`
    INSERT INTO "orders" (
      "company_id", "order_year", "order_sequence", "priority", "status", "created_by", "updated_by",
      "created_at", "updated_at", "customer_id"
    ) VALUES (
      ${companyId}::uuid,
      ${year}::integer,
      (SELECT COALESCE(max("order_sequence"), 0) + 1
         FROM "orders"
        WHERE "company_id" = ${companyId}::uuid
          AND "order_year" = ${year}::integer),
      ${data.priority}::"OrderPriority",
      ${data.status}::"OrderStatus",
      ${actorId}::uuid,
      ${actorId}::uuid,
      ${now}::timestamptz,
      ${now}::timestamptz,
      ${data.customerId}::uuid
    )
    RETURNING "id", "order_year", "order_sequence"
  `);

  const row = filas[0];
  if (row === undefined) {
    // Un `INSERT ... RETURNING` que no devuelve fila no tiene lectura posible: no se inventa
    // un pedido con id vacio, se propaga con contexto (`docs/conventions.md`).
    throw new Error('El INSERT de pedido no devolvio ninguna fila.');
  }

  return {
    id: row.id,
    number: { year: Number(row.order_year), sequence: Number(row.order_sequence) },
    priority: data.priority,
    status: data.status,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
    updatedBy: actorId,
    customerId: data.customerId,
  };
}

/**
 * `setStatus` de `OrderWriteRepository`: `UPDATE` condicional `WHERE status = from` sobre el
 * cliente de la transaccion en curso, sin `assertTransition` -esa comprobacion ya la hizo el
 * dominio sobre la fila que acaba de bloquear `lockAliveById`-.
 *
 * No toca `finishedAt` con ningun destino: un `TERMINADO` que pase a `ENTREGADO` la conserva.
 */
async function setAliveOrderStatus(
  id: string,
  from: OrderStatus,
  to: OrderStatus,
  actorId: string | null,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<'ok' | 'not_found' | 'stale'> {
  const { count } = await tx.order.updateMany({
    where: { AND: [orderCompanyScope(scope), { id, deletedAt: null, status: from }] },
    data: {
      status: to,
      updatedAt: now,
      updatedBy: actorId,
    },
  });
  if (count === 1) return 'ok';

  const stillAlive = await tx.order.findFirst({
    where: { AND: [orderCompanyScope(scope), { id, deletedAt: null }] },
    select: { id: true },
  });
  return stillAlive === null ? 'not_found' : 'stale';
}

const ORDER_LINE_SELECT = {
  id: true,
  orderId: true,
  position: true,
  recipeId: true,
  originalRecipeId: true,
  quantity: true,
  unitId: true,
  status: true,
  cancellationReason: true,
  ingredientsCost: true,
  packagingCost: true,
  actualCost: true,
  salePrice: true,
  reservedAt: true,
  finishedAt: true,
  packedBy: true,
  conditionedBy: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
} satisfies Prisma.OrderLineSelect;

type OrderLinePrismaRow = Prisma.OrderLineGetPayload<{ select: typeof ORDER_LINE_SELECT }>;

function toOrderLineStatus(status: OrderStatus): OrderLineStatus {
  // El CHECK `order_lines_status_not_partial` lo impide; si llega, la fila se escribio por fuera.
  if (status === 'PARCIAL') throw new Error('una linea de pedido no puede estar en PARCIAL');
  return status;
}

function toOrderLineRow(row: OrderLinePrismaRow, presentationLines: readonly OrderPresentationLineRow[]): OrderLineRow {
  return {
    id: row.id,
    orderId: row.orderId,
    position: row.position,
    recipeId: row.recipeId,
    originalRecipeId: row.originalRecipeId,
    quantity: fromDecimal(row.quantity),
    unitId: row.unitId,
    status: toOrderLineStatus(row.status),
    cancellationReason: row.cancellationReason,
    ingredientsCost: row.ingredientsCost === null ? null : fromDecimal(row.ingredientsCost),
    packagingCost: row.packagingCost === null ? null : fromDecimal(row.packagingCost),
    actualCost: row.actualCost === null ? null : fromDecimal(row.actualCost),
    salePrice: row.salePrice === null ? null : fromDecimal(row.salePrice),
    reservedAt: row.reservedAt,
    finishedAt: row.finishedAt,
    packedBy: row.packedBy,
    conditionedBy: row.conditionedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    presentationLines,
  };
}

/** Las lineas pedidas con su reparto, en el orden de `where` por `position`. */
async function readOrderLines(
  where: Prisma.OrderLineWhereInput,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<readonly OrderLineRow[]> {
  const { companyId } = companyScopeColumns(scope);
  const rows = await tx.orderLine.findMany({
    where: { AND: [{ companyId }, where] },
    select: ORDER_LINE_SELECT,
    orderBy: [{ position: 'asc' }],
  });
  if (rows.length === 0) return [];

  const distribution = await tx.orderPresentationLine.findMany({
    where: { companyId, orderLineId: { in: rows.map((row) => row.id) } },
    select: {
      orderLineId: true,
      presentationId: true,
      packages: true,
      presentationContent: true,
      packagingProductId: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const byLine = new Map<string, OrderPresentationLineRow[]>();
  for (const item of distribution) {
    const list = byLine.get(item.orderLineId) ?? [];
    list.push({
      presentationId: item.presentationId,
      packages: item.packages,
      presentationContent: item.presentationContent === null ? null : fromDecimal(item.presentationContent),
      packagingProductId: item.packagingProductId,
    });
    byLine.set(item.orderLineId, list);
  }
  return rows.map((row) => toOrderLineRow(row, byLine.get(row.id) ?? []));
}

/** `findAliveLines` de `OrderRepository`. */
export async function findAliveOrderLines(
  orderId: string,
  scope: OrderScope,
  tx: PrismaLike = prisma,
): Promise<readonly OrderLineRow[]> {
  return readOrderLines({ orderId, deletedAt: null }, scope, tx);
}

/** `findAliveLinesByOrderIds` de `OrderRepository`. */
export async function findAliveOrderLinesByOrderIds(
  orderIds: readonly string[],
  scope: OrderScope,
): Promise<readonly OrderLineRow[]> {
  if (orderIds.length === 0) return [];
  return readOrderLines({ orderId: { in: [...orderIds] }, deletedAt: null }, scope, prisma);
}

/** `lockAliveLines` de `OrderWriteRepository`. El `ORDER BY` va antes del bloqueo, asi que las
 *  lineas se bloquean por `position`. */
async function lockAliveOrderLines(
  orderId: string,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<LockedOrderLines | null> {
  const order = await lockAliveOrderById(orderId, scope, tx);
  if (order === null) return null;

  const { companyId } = companyScopeColumns(scope);
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
      FROM "order_lines"
     WHERE "order_id" = ${orderId}::uuid
       AND "company_id" = ${companyId}::uuid
       AND "deleted_at" IS NULL
     ORDER BY "position"
       FOR UPDATE
  `);
  return { order, lines: await readOrderLines({ orderId, deletedAt: null }, scope, tx) };
}

/** `lockAliveLine` de `OrderWriteRepository`. */
async function lockAliveOrderLine(
  orderId: string,
  lineId: string,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<LockedOrderLine | null> {
  const order = await lockAliveOrderById(orderId, scope, tx);
  if (order === null) return null;

  const { companyId } = companyScopeColumns(scope);
  const locked = await tx.$queryRaw<ReadonlyArray<{ readonly id: string }>>(Prisma.sql`
    SELECT "id"
      FROM "order_lines"
     WHERE "id" = ${lineId}::uuid
       AND "order_id" = ${orderId}::uuid
       AND "company_id" = ${companyId}::uuid
       AND "deleted_at" IS NULL
       FOR UPDATE
  `);
  if (locked.length === 0) return null;

  const [line] = await readOrderLines({ id: lineId, orderId, deletedAt: null }, scope, tx);
  return line === undefined ? null : { order, line };
}

/** El unico de receta activa por pedido. Es el unico indice unico de `order_lines` que nombra
 *  `original_recipe_id`; segun el motor, `meta.target` trae sus columnas o su nombre. */
const ORDER_LINE_RECIPE_UNIQUE_MARKERS = ['order_lines_order_original_recipe_active_key', 'original_recipe_id'] as const;

function isDuplicateOrderRecipe(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  const targets = typeof target === 'string' ? [target] : Array.isArray(target) ? target : [];
  return ORDER_LINE_RECIPE_UNIQUE_MARKERS.some((marker) =>
    targets.some((item) => typeof item === 'string' && item.includes(marker)),
  );
}

async function translatingDuplicateRecipe<T>(write: () => Promise<T>, diagnostic: string): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isDuplicateOrderRecipe(error)) throw new DuplicateOrderRecipeError(diagnostic);
    throw error;
  }
}

/** Reemplaza el reparto de una linea. Escribe tambien `order_id`: las entregas lo leen de ahi. */
async function replaceLinePresentationLines(
  tx: PrismaLike,
  orderId: string,
  lineId: string,
  scope: OrderScope,
  lines: readonly OrderPresentationLineWrite[],
  now: Date,
): Promise<void> {
  const { companyId } = companyScopeColumns(scope);
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "order_presentation_lines"
     WHERE "order_line_id" = ${lineId}::uuid
       AND "order_id" = ${orderId}::uuid
       AND "company_id" = ${companyId}::uuid
  `);
  for (const line of lines) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "order_presentation_lines" (
        "order_id", "order_line_id", "company_id", "presentation_id", "packages",
        "presentation_content", "packaging_product_id", "created_at", "updated_at"
      ) VALUES (
        ${orderId}::uuid,
        ${lineId}::uuid,
        ${companyId}::uuid,
        ${line.presentationId}::uuid,
        ${line.packages}::integer,
        ${line.content === null ? null : toDecimalInput(line.content)}::numeric,
        ${line.packagingProductId}::uuid,
        ${now}::timestamptz,
        ${now}::timestamptz
      )
    `);
  }
}

function lineColumns(line: OrderLineWrite): {
  recipeId: string;
  originalRecipeId: string;
  quantity: Prisma.Decimal;
  unitId: string;
  salePrice: Prisma.Decimal | null;
} {
  return {
    recipeId: line.recipeId,
    originalRecipeId: line.originalRecipeId,
    quantity: toDecimalInput(line.quantity),
    unitId: line.unitId,
    salePrice: line.salePrice === null ? null : toDecimalInput(line.salePrice),
  };
}

/** Quita las lineas: `deleted_at` y fuera su reparto. `false` si alguna no es del pedido. */
async function removeOrderLines(
  orderId: string,
  lineIds: readonly string[],
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<boolean> {
  if (lineIds.length === 0) return true;
  const { companyId } = companyScopeColumns(scope);
  const { count } = await tx.orderLine.updateMany({
    where: { id: { in: [...lineIds] }, orderId, companyId, deletedAt: null },
    data: { deletedAt: now, updatedAt: now, updatedBy: actorId },
  });
  if (count !== new Set(lineIds).size) return false;
  await tx.orderPresentationLine.deleteMany({
    where: { orderLineId: { in: [...lineIds] }, orderId, companyId },
  });
  return true;
}

/**
 * Dos o mas lineas que cambian de receta salen un momento del unico de receta activa -con
 * `deleted_at` dentro de esta transaccion- y vuelven al final, para que dos lineas que se
 * intercambian la receta no choquen a mitad de camino. Solo cambia de receta una linea en estado
 * editable, y la base deja quitar las de esos estados. Devuelve las lineas apartadas.
 */
async function parkLinesChangingRecipe(
  orderId: string,
  edited: readonly OrderLineEditWrite[],
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<readonly string[]> {
  if (edited.length < 2) return [];
  const { companyId } = companyScopeColumns(scope);
  const target = new Map(edited.map((edit) => [edit.lineId, edit.line.originalRecipeId]));
  const current = await tx.orderLine.findMany({
    where: { id: { in: [...target.keys()] }, orderId, companyId, deletedAt: null },
    select: { id: true, originalRecipeId: true },
  });
  const ids = current.filter((row) => row.originalRecipeId !== target.get(row.id)).map((row) => row.id);
  if (ids.length < 2) return [];
  await tx.orderLine.updateMany({ where: { id: { in: ids }, orderId, companyId, deletedAt: null }, data: { deletedAt: now } });
  return ids;
}

async function unparkLines(
  orderId: string,
  ids: readonly string[],
  parkedAt: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<void> {
  if (ids.length === 0) return;
  const { companyId } = companyScopeColumns(scope);
  await translatingDuplicateRecipe(
    () => tx.orderLine.updateMany({ where: { id: { in: [...ids] }, orderId, companyId, deletedAt: parkedAt }, data: { deletedAt: null } }),
    `dos lineas del pedido ${orderId} acaban con la misma receta`,
  );
}

async function editOrderLine(
  orderId: string,
  edit: OrderLineEditWrite,
  parkedAt: Date | null,
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<boolean> {
  const { companyId } = companyScopeColumns(scope);
  const { count } = await translatingDuplicateRecipe(
    () =>
      tx.orderLine.updateMany({
        where: { id: edit.lineId, orderId, companyId, deletedAt: parkedAt },
        data: {
          ...lineColumns(edit.line),
          ...(edit.cost === 'keep' ? {} : costColumns(edit.cost)),
          updatedAt: now,
          updatedBy: actorId,
        },
      }),
    `receta ${edit.line.originalRecipeId} ya activa en el pedido ${orderId}`,
  );
  if (count !== 1) return false;
  await replaceLinePresentationLines(tx, orderId, edit.lineId, scope, edit.line.presentationLines, now);
  return true;
}

async function addOrderLines(
  orderId: string,
  added: readonly NewOrderLine[],
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<readonly string[]> {
  if (added.length === 0) return [];
  const { companyId } = companyScopeColumns(scope);
  // Sentencia nueva bajo el candado del pedido: ve las posiciones que confirmo quien lo tenia antes.
  const { _max } = await tx.orderLine.aggregate({ where: { orderId, companyId }, _max: { position: true } });
  let position = (_max.position ?? -1) + 1;

  const ids: string[] = [];
  for (const line of added) {
    const { id } = await translatingDuplicateRecipe(
      () =>
        tx.orderLine.create({
          data: {
            orderId,
            companyId,
            position,
            ...lineColumns(line),
            status: line.status,
            ...costColumns(line.cost),
            createdAt: now,
            updatedAt: now,
            createdBy: actorId,
            updatedBy: actorId,
          },
          select: { id: true },
        }),
      `receta ${line.originalRecipeId} ya activa en el pedido ${orderId}`,
    );
    await replaceLinePresentationLines(tx, orderId, id, scope, line.presentationLines, now);
    ids.push(id);
    position += 1;
  }
  return ids;
}

/** `writeLines` de `OrderWriteRepository`. */
async function writeOrderLines(
  orderId: string,
  changes: OrderLineChanges,
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<readonly OrderLineRow[] | null> {
  if ((await lockAliveOrderById(orderId, scope, tx)) === null) return null;

  if (!(await removeOrderLines(orderId, changes.removedIds, actorId, now, scope, tx))) return null;
  const parked = await parkLinesChangingRecipe(orderId, changes.edited, now, scope, tx);
  for (const edit of changes.edited) {
    const parkedAt = parked.includes(edit.lineId) ? now : null;
    if (!(await editOrderLine(orderId, edit, parkedAt, actorId, now, scope, tx))) return null;
  }
  await unparkLines(orderId, parked, now, scope, tx);
  const ids = await addOrderLines(orderId, changes.added, actorId, now, scope, tx);
  if (ids.length === 0) return [];

  const rows = await readOrderLines({ id: { in: [...ids] }, orderId }, scope, tx);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => {
    const row = byId.get(id);
    if (row === undefined) throw new Error(`la linea ${id} recien escrita no se pudo releer`);
    return row;
  });
}

/** `cancelLine` de `OrderWriteRepository`: estado y motivo juntos, como exige
 *  `order_lines_cancellation_reason_matches_status`. */
async function cancelAliveOrderLine(
  orderId: string,
  lineId: string,
  reason: string,
  actorId: string | null,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<'ok' | 'not_found'> {
  const { companyId } = companyScopeColumns(scope);
  const { count } = await tx.orderLine.updateMany({
    where: { id: lineId, orderId, companyId, deletedAt: null },
    data: { status: 'CANCELADO', cancellationReason: reason, updatedAt: now, updatedBy: actorId },
  });
  return count === 1 ? 'ok' : 'not_found';
}

/** `setLineStatus` de `OrderWriteRepository`. */
async function setAliveOrderLineStatus(
  orderId: string,
  lineId: string,
  from: OrderLineStatus,
  to: Exclude<OrderLineStatus, 'CANCELADO'>,
  actorId: string | null,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<'ok' | 'not_found' | 'stale'> {
  const { companyId } = companyScopeColumns(scope);
  const { count } = await tx.orderLine.updateMany({
    where: { id: lineId, orderId, companyId, deletedAt: null, status: from },
    data: { status: to, updatedAt: now, updatedBy: actorId },
  });
  if (count === 1) return 'ok';

  const stillAlive = await tx.orderLine.findFirst({
    where: { id: lineId, orderId, companyId, deletedAt: null },
    select: { id: true },
  });
  return stillAlive === null ? 'not_found' : 'stale';
}

/** `setLineIngredientsCost` de `OrderWriteRepository`. */
async function setAliveOrderLineIngredientsCost(
  orderId: string,
  lineId: string,
  cost: StoredOrderCost | null,
  actorId: string | null,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<'ok' | 'not_found'> {
  const { companyId } = companyScopeColumns(scope);
  const { count } = await tx.orderLine.updateMany({
    where: { id: lineId, orderId, companyId, deletedAt: null },
    data: { ...costColumns(cost), updatedAt: now, updatedBy: actorId },
  });
  return count === 1 ? 'ok' : 'not_found';
}

/** `setLineReservedAt` de `OrderWriteRepository`. `$executeRaw` y no la API tipada: Prisma moveria
 *  `updated_at`, y apartar o liberar material no es una edicion que el usuario deba ver ahi. */
async function setOrderLineReservedAt(
  orderId: string,
  lineId: string,
  reservedAt: Date | null,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<void> {
  const { companyId } = companyScopeColumns(scope);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "order_lines"
       SET "reserved_at" = ${reservedAt}::timestamptz
     WHERE "id" = ${lineId}::uuid
       AND "order_id" = ${orderId}::uuid
       AND "company_id" = ${companyId}::uuid
       AND "deleted_at" IS NULL
  `);
}

/** `refreshStatus` de `OrderWriteRepository`. */
async function refreshAliveOrderStatus(
  orderId: string,
  actorId: string | null,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<OrderStatus | null> {
  const order = await tx.order.findFirst({
    where: { AND: [orderCompanyScope(scope), { id: orderId, deletedAt: null }] },
    select: { status: true, cancellationReason: true },
  });
  if (order === null) return null;

  const { companyId } = companyScopeColumns(scope);
  const lines = await tx.orderLine.findMany({
    where: { orderId, companyId, deletedAt: null },
    select: { status: true, cancellationReason: true },
    orderBy: [{ updatedAt: 'desc' }, { position: 'desc' }],
  });
  const status = deriveOrderStatus(lines.map((line) => ({ status: toOrderLineStatus(line.status) })));
  const reason =
    status === 'CANCELADO' ? (lines.find((line) => line.status === 'CANCELADO')?.cancellationReason ?? null) : null;
  // Sin cambio de estado ni de motivo el pedido no se da por modificado.
  if (status === order.status && reason === order.cancellationReason) return status;

  // Estado y motivo en la misma sentencia: `orders_cancellation_reason_matches_status` los mira juntos.
  await tx.order.updateMany({
    where: { AND: [orderCompanyScope(scope), { id: orderId, deletedAt: null }] },
    data: { status, cancellationReason: reason, updatedAt: now, updatedBy: actorId },
  });
  return status;
}

/** `setCustomerAlive` de `OrderWriteRepository`: `data` no lleva ninguna otra columna, para que
 *  cambiar el cliente no toque el estado, el importe ni lo apartado. */
async function setAliveOrderCustomer(
  id: string,
  customerId: string | null,
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<'ok' | 'not_found'> {
  const { count } = await tx.order.updateMany({
    where: { AND: [orderCompanyScope(scope), { id, deletedAt: null }] },
    data: { customerId, updatedBy: actorId, updatedAt: now },
  });
  return count === 1 ? 'ok' : 'not_found';
}

/** `findBlockedIds`: el filtro coincide con el indice parcial `order_lines_company_status_idx`. */
export async function findBlockedOrderIds(scope: OrderScope): Promise<readonly BlockedOrderLineRef[]> {
  const { companyId } = companyScopeColumns(scope);
  const rows = await prisma.orderLine.findMany({
    where: { companyId, status: 'BLOQUEADO', deletedAt: null, order: { deletedAt: null } },
    select: { id: true, orderId: true },
    orderBy: [{ order: { createdAt: 'asc' } }, { order: { id: 'asc' } }, { position: 'asc' }],
  });
  return rows.map((row) => ({ orderId: row.orderId, lineId: row.id }));
}

/**
 * Lineas candidatas a caducar de UNA empresa: `PENDIENTE`, vivas, de un pedido vivo, con la reserva
 * vencida en el umbral o antes. Usa `order_lines_expirable_idx` y su mismo orden, `reserved_at, id`,
 * para que dos lotes seguidos avancen sin saltarse ni repetir una linea que empata en `reserved_at`.
 *
 * `cursor` es el ultimo `(reservedAt, lineId)` que devolvio el lote anterior: `null` en el primero.
 * Con cursor, solo se piden filas ESTRICTAMENTE posteriores en ese orden, para que un candidato
 * que fallo en el lote anterior no vuelva a salir en esta ejecucion.
 *
 * `companyId` es un parametro por su cuenta, y no solo lo que trae `scope`: quien recorre las
 * empresas no tiene un `OrderScope` que construir para el bucle, solo el identificador que le
 * dio el directorio de empresas. `scope` sigue yendo al final, como el resto del modulo.
 */
export async function findExpirableOrders(
  companyId: string,
  threshold: Date,
  cursor: { readonly reservedAt: Date; readonly lineId: string } | null,
  limit: number,
  scope: OrderScope,
): Promise<readonly { readonly orderId: string; readonly lineId: string; readonly reservedAt: Date }[]> {
  const rows = await prisma.orderLine.findMany({
    where: {
      AND: [
        companyScopeColumns(scope),
        { status: 'PENDIENTE', deletedAt: null, reservedAt: { lte: threshold }, order: { deletedAt: null } },
        ...(cursor === null
          ? []
          : [
              {
                OR: [
                  { reservedAt: { gt: cursor.reservedAt } },
                  { reservedAt: cursor.reservedAt, id: { gt: cursor.lineId } },
                ],
              },
            ]),
      ],
    },
    select: { id: true, orderId: true, reservedAt: true },
    orderBy: [{ reservedAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });
  return rows.map((row) => {
    if (row.reservedAt === null) {
      throw new Error('candidato sin reserved_at pese al filtro de la consulta');
    }
    return { orderId: row.orderId, lineId: row.id, reservedAt: row.reservedAt };
  });
}

/**
 * Fabrica de `OrderWriteRepository` sobre el cliente que le pasen -global o transaccional-,
 * mismo patron que `createOrderAssignmentRepository`. Sin argumento habla por el `PrismaClient`
 * global; `OrderUnitOfWork` la invoca con el `tx` de su transaccion.
 */
export function createOrderWriteRepository(tx: PrismaLike = prisma): OrderWriteRepository {
  return {
    lockAliveById: (id, scope) => lockAliveOrderById(id, scope, tx),
    lockAliveLines: (orderId, scope) => lockAliveOrderLines(orderId, scope, tx),
    lockAliveLine: (orderId, lineId, scope) => lockAliveOrderLine(orderId, lineId, scope, tx),
    writeLines: (orderId, changes, actorId, now, scope) => writeOrderLines(orderId, changes, actorId, now, scope, tx),
    cancelLine: (orderId, lineId, reason, actorId, now, scope) =>
      cancelAliveOrderLine(orderId, lineId, reason, actorId, now, scope, tx),
    setLineStatus: (orderId, lineId, from, to, actorId, now, scope) =>
      setAliveOrderLineStatus(orderId, lineId, from, to, actorId, now, scope, tx),
    setLineIngredientsCost: (orderId, lineId, cost, actorId, now, scope) =>
      setAliveOrderLineIngredientsCost(orderId, lineId, cost, actorId, now, scope, tx),
    setLineReservedAt: (orderId, lineId, reservedAt, scope) => setOrderLineReservedAt(orderId, lineId, reservedAt, scope, tx),
    refreshStatus: (orderId, actorId, now, scope) => refreshAliveOrderStatus(orderId, actorId, now, scope, tx),
    create: (data, year, actorId, now, scope) => insertAliveOrder(tx, data, year, actorId, now, scope),
    updateAlive: (id, data, actorId, now, scope) => updateAliveOrder(id, data, actorId, now, scope, tx),
    cancelAlive: (id, reason, actorId, now, scope) => cancelAliveOrder(id, reason, actorId, now, scope, tx),
    softDeleteAlive: (id, actorId, now, scope) => softDeleteAliveOrder(id, actorId, now, scope, tx),
    setStatus: (id, from, to, actorId, now, scope) => setAliveOrderStatus(id, from, to, actorId, now, scope, tx),
    setCustomerAlive: (id, customerId, actorId, now, scope) =>
      setAliveOrderCustomer(id, customerId, actorId, now, scope, tx),
    stampLineStatus: (orderId, lineId, from, to, stamp, actorId, now, scope) =>
      stampAliveOrderLineStatus(orderId, lineId, from, to, stamp, actorId, now, scope, tx),
    setLineActualCost: (orderId, lineId, cost, scope) => setOrderLineActualCost(orderId, lineId, cost, scope, tx),
    findPresentationLinesForFinish: (id, scope) => findPresentationLinesForFinishOrder(id, scope, tx),
    recordPackedCounts: (id, counts, scope) => recordPackedCountsForOrder(id, counts, scope, tx),
  };
}

/** Lo que Comenzar y Terminar necesitan de la linea bloqueada para clasificar el resultado. */
type LockedStageLine = {
  readonly status: OrderStatus;
  readonly packed_by: string | null;
  readonly conditioned_by: string | null;
};

/**
 * `FOR UPDATE` del pedido vivo y despues de su linea viva, en ese orden, como `lockAliveLine`.
 * `null` si el pedido no existe, esta borrado o es de otra empresa, o si la linea no es suya.
 */
async function lockStageLine(
  orderId: string,
  lineId: string,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<LockedStageLine | null> {
  const { companyId } = companyScopeColumns(scope);
  const orders = await tx.$queryRaw<ReadonlyArray<{ readonly id: string }>>(Prisma.sql`
    SELECT "id"
      FROM "orders"
     WHERE "id" = ${orderId}::uuid
       AND "company_id" = ${companyId}::uuid
       AND "deleted_at" IS NULL
       FOR UPDATE
  `);
  if (orders.length === 0) return null;
  const lines = await tx.$queryRaw<ReadonlyArray<LockedStageLine>>(Prisma.sql`
    SELECT "status", "packed_by", "conditioned_by"
      FROM "order_lines"
     WHERE "id" = ${lineId}::uuid
       AND "order_id" = ${orderId}::uuid
       AND "company_id" = ${companyId}::uuid
       AND "deleted_at" IS NULL
       FOR UPDATE
  `);
  return lines[0] ?? null;
}

/** `stampLineStatus` de `OrderWriteRepository`: el estado y su sello en la misma sentencia, como
 *  exigen los CHECK de la linea. */
async function stampAliveOrderLineStatus(
  orderId: string,
  lineId: string,
  from: OrderLineStatus,
  to: Exclude<OrderLineStatus, 'CANCELADO'>,
  stamp: LineStageStamp,
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<'ok' | 'not_found' | 'stale'> {
  const { companyId } = companyScopeColumns(scope);
  const { count } = await tx.orderLine.updateMany({
    where: { id: lineId, orderId, companyId, deletedAt: null, status: from },
    data: { status: to, ...stamp, updatedAt: now, updatedBy: actorId },
  });
  if (count === 1) return 'ok';

  const stillAlive = await tx.orderLine.findFirst({
    where: { id: lineId, orderId, companyId, deletedAt: null },
    select: { id: true },
  });
  return stillAlive === null ? 'not_found' : 'stale';
}

/** `setLineActualCost` de `OrderWriteRepository`. `$executeRaw` para no mover `updated_at`: la
 *  misma transaccion ya lo sello al mover la linea. */
async function setOrderLineActualCost(
  orderId: string,
  lineId: string,
  cost: string | null,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<void> {
  const { companyId } = companyScopeColumns(scope);
  const value = cost === null ? null : toDecimalInput(cost);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "order_lines"
       SET "actual_cost" = ${value}::numeric
     WHERE "id" = ${lineId}::uuid
       AND "order_id" = ${orderId}::uuid
       AND "company_id" = ${companyId}::uuid
       AND "deleted_at" IS NULL
  `);
}

/** Mueve la linea con su sello y vuelve a derivar el pedido, en la transaccion de quien llama. */
async function moveStageLine(
  orderId: string,
  lineId: string,
  from: OrderLineStatus,
  to: Exclude<OrderLineStatus, 'CANCELADO'>,
  stamp: LineStageStamp,
  actorId: string,
  now: Date,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<void> {
  const moved = await stampAliveOrderLineStatus(orderId, lineId, from, to, stamp, actorId, now, scope, tx);
  // La linea esta bloqueada desde `lockStageLine` en esta misma transaccion: nadie pudo moverla.
  if (moved !== 'ok') throw new Error(`la linea ${lineId} devolvio '${moved}' con el pedido bloqueado`);
  await refreshAliveOrderStatus(orderId, actorId, now, scope, tx);
}

/**
 * Implementa `OrderPackingRepository['startPackingAlive']` (Comenzar) sobre una linea: bloquea el
 * pedido y la linea, y solo con ellos bloqueados cuenta el reparto de la linea -en una sentencia
 * NUEVA, para que vea lo que confirmo un guardado del reparto que esperaba el mismo bloqueo- y
 * escribe. Se descarta un `EXISTS` dentro del `WHERE` del `UPDATE`: al reevaluar tras esperar el
 * bloqueo, la subconsulta puede seguir usando la foto del inicio de la sentencia.
 */
export async function startPackingAliveOrder(
  id: string,
  lineId: string,
  packerId: string,
  now: Date,
  scope: OrderScope,
  db: PrismaLike = prisma,
): Promise<'ok' | 'already_mine' | 'taken' | 'not_packable' | 'not_found' | 'without_distribution'> {
  // Sobre el cliente global abre su propia transaccion; sobre una ya abierta, escribe en ella.
  const work = async (tx: PrismaLike) => {
    const locked = await lockStageLine(id, lineId, scope, tx);
    if (locked === null) return 'not_found';

    if (locked.status !== 'POR_EMPACAR') {
      if (locked.status === 'EN_EMPAQUE') return locked.packed_by === packerId ? 'already_mine' : 'taken';
      return 'not_packable';
    }

    const { companyId } = companyScopeColumns(scope);
    const [conteo] = await tx.$queryRaw<ReadonlyArray<{ total: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS total
        FROM "order_presentation_lines"
       WHERE "order_id" = ${id}::uuid
         AND "order_line_id" = ${lineId}::uuid
         AND "company_id" = ${companyId}::uuid
    `);
    if (conteo === undefined || conteo.total === BigInt(0)) return 'without_distribution';

    await moveStageLine(id, lineId, 'POR_EMPACAR', 'EN_EMPAQUE', { packedBy: packerId }, packerId, now, scope, tx);
    return 'ok';
  };
  return db === prisma ? prisma.$transaction((tx) => work(tx)) : work(db);
}

/**
 * Fabrica de `OrderPackingRepository` sobre el cliente que le pasen. Con un `tx`, Comenzar se
 * escribe dentro de la transaccion de quien llama y se deshace con ella; con el global abre la suya.
 */
export function createOrderPackingRepository(db: PrismaLike = prisma): OrderPackingRepository {
  return {
    startPackingAlive: (id, lineId, packerId, now, scope) => startPackingAliveOrder(id, lineId, packerId, now, scope, db),
  };
}

/** Implementa `OrderConditioningRepository['startConditioningAlive']` sobre una linea, con el pedido
 *  y la linea bloqueados. */
export async function startConditioningAliveOrder(
  id: string,
  lineId: string,
  conditionerId: string,
  now: Date,
  scope: OrderScope,
  db: PrismaLike = prisma,
): Promise<'ok' | 'already_mine' | 'taken' | 'not_conditionable' | 'not_found'> {
  // Sobre el cliente global abre su propia transaccion; sobre una ya abierta, escribe en ella.
  const work = async (tx: PrismaLike) => {
    const locked = await lockStageLine(id, lineId, scope, tx);
    if (locked === null) return 'not_found';
    if (locked.status === 'EN_ACONDICIONAMIENTO') {
      return locked.conditioned_by === conditionerId ? 'already_mine' : 'taken';
    }
    if (locked.status !== 'POR_ACONDICIONAR') return 'not_conditionable';

    await moveStageLine(
      id,
      lineId,
      'POR_ACONDICIONAR',
      'EN_ACONDICIONAMIENTO',
      { conditionedBy: conditionerId },
      conditionerId,
      now,
      scope,
      tx,
    );
    return 'ok';
  };
  return db === prisma ? prisma.$transaction((tx) => work(tx)) : work(db);
}

/** Implementa `OrderConditioningRepository['finishConditioningAlive']`: el estado y `finished_at` de
 *  la linea van en la misma sentencia, que exige ademas ser quien acondiciona, y despues se deriva el
 *  pedido. */
export async function finishConditioningAliveOrder(
  id: string,
  lineId: string,
  conditionerId: string,
  now: Date,
  scope: OrderScope,
  db: PrismaLike = prisma,
): Promise<'ok' | 'not_conditioner' | 'not_conditionable' | 'not_found'> {
  // Sobre el cliente global abre su propia transaccion; sobre una ya abierta, escribe en ella.
  const work = async (tx: PrismaLike) => {
    const locked = await lockStageLine(id, lineId, scope, tx);
    if (locked === null) return 'not_found';
    if (locked.status !== 'EN_ACONDICIONAMIENTO') return 'not_conditionable';
    if (locked.conditioned_by !== conditionerId) return 'not_conditioner';

    const { companyId } = companyScopeColumns(scope);
    const { count } = await tx.orderLine.updateMany({
      where: { id: lineId, orderId: id, companyId, deletedAt: null, status: 'EN_ACONDICIONAMIENTO', conditionedBy: conditionerId },
      data: { status: 'TERMINADO', finishedAt: now, updatedAt: now, updatedBy: conditionerId },
    });
    // La linea esta bloqueada desde `lockStageLine` en esta misma transaccion: nadie pudo moverla.
    if (count !== 1) throw new Error(`la linea ${lineId} no paso a TERMINADO con el pedido bloqueado`);
    await refreshAliveOrderStatus(id, conditionerId, now, scope, tx);
    return 'ok';
  };
  return db === prisma ? prisma.$transaction((tx) => work(tx)) : work(db);
}

/**
 * Fabrica de `OrderConditioningRepository` sobre el cliente que le pasen. Con un `tx`, Comenzar y
 * Terminar se escriben dentro de la transaccion de quien llama y se deshacen con ella.
 */
export function createOrderConditioningRepository(db: PrismaLike = prisma): OrderConditioningRepository {
  return {
    startConditioningAlive: (id, lineId, conditionerId, now, scope) =>
      startConditioningAliveOrder(id, lineId, conditionerId, now, scope, db),
    finishConditioningAlive: (id, lineId, conditionerId, now, scope) =>
      finishConditioningAliveOrder(id, lineId, conditionerId, now, scope, db),
  };
}

/** Fila cruda de una linea del reparto para Terminar el empaque: `FOR SHARE`, en el
 *  orden de alta, dentro de la MISMA transaccion que mueve la linea. */
type FinishPackingLineRow = {
  readonly id: string;
  readonly presentation_id: string;
  readonly packages: number;
  readonly presentation_content: string | null;
  readonly packaging_product_id: string | null;
  readonly packed_packages: number | null;
  readonly packed_surplus_packages: number;
  readonly order_line_id: string;
};

async function findPresentationLinesForFinishOrder(
  id: string,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<readonly FinishPackingLine[]> {
  const { companyId } = companyScopeColumns(scope);
  const rows = await tx.$queryRaw<ReadonlyArray<FinishPackingLineRow>>(Prisma.sql`
    SELECT "id", "presentation_id", "packages", "presentation_content"::text AS "presentation_content",
           "packaging_product_id", "packed_packages", "packed_surplus_packages", "order_line_id"
      FROM "order_presentation_lines"
     WHERE "order_id" = ${id}::uuid
       AND "company_id" = ${companyId}::uuid
     ORDER BY "created_at" ASC, "id" ASC
     FOR SHARE
  `);
  return rows.map((row) => ({
    id: row.id,
    presentationId: row.presentation_id,
    packages: row.packages,
    presentationContent: row.presentation_content,
    packagingProductId: row.packaging_product_id,
    packedPackages: row.packed_packages,
    packedSurplusPackages: row.packed_surplus_packages,
    orderLineId: row.order_line_id,
  }));
}

async function recordPackedCountsForOrder(
  id: string,
  counts: readonly RecordedPackedLine[],
  scope: OrderScope,
  tx: PrismaLike,
): Promise<void> {
  const { companyId } = companyScopeColumns(scope);
  for (const count of counts) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "order_presentation_lines"
         SET "packed_packages" = ${count.packedPackages}::integer,
             "packed_reason" = ${count.reason}::text,
             "packed_reason_other" = ${count.reasonOther === null ? null : count.reasonOther.trim()}::text,
             "packed_surplus_packages" = ${count.packedSurplusPackages}::integer
       WHERE "id" = ${count.lineId}::uuid
         AND "order_id" = ${id}::uuid
         AND "company_id" = ${companyId}::uuid
    `);
  }
}
