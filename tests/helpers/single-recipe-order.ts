// La entrada de una sola receta -la forma del formulario de hoy- traducida a la de lineas que
// validan `createOrder` y `updateOrder`, igual que hace el puente de `order-actions.ts`. Los tests
// escritos antes de las lineas siguen describiendo un pedido de una receta y llaman a los casos de
// uso con esta traduccion.

import { vi } from 'vitest';

import { createCreateOrder, type CreateOrderDeps } from '@/lib/modules/pedidos/domain/create-order';
import { createUpdateOrder, type UpdateOrderDeps } from '@/lib/modules/pedidos/domain/update-order';
import type {
  createUpdateOrderPresentationLines,
  UpdateOrderPresentationLinesInput,
} from '@/lib/modules/pedidos/domain/update-order-presentation-lines';
import { fakeOrderRow, ONLY_LINE_ID, orderLineOf } from '@/tests/helpers/order-unit-of-work-double';

import type { Actor } from '@/lib/modules/pedidos/domain/actor';
import type { OrderScope } from '@/lib/modules/pedidos/domain/order-scope';
import type { OrderLineRow } from '@/lib/modules/pedidos/domain/order-view';
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository';
import type { OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { OrderWriteRepository } from '@/lib/modules/pedidos/ports/order-write-repository';

const LINE_KEYS = ['recipeId', 'recipeVersionId', 'quantity', 'unitId', 'presentationLines', 'salePrice'] as const;
const ORDER_KEYS = ['priority', 'customerId', 'confirmBlocked'] as const;

/** Un pedido de una linea con los campos de la receta; prioridad, cliente y confirmacion van en el
 *  pedido. Lo que no sea un objeto se entrega tal cual, para que lo rechace el esquema. */
export function singleLineInput(input: unknown, lineId?: string): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const source = input as Record<string, unknown>;
  const line: Record<string, unknown> = lineId === undefined ? {} : { id: lineId };
  for (const key of LINE_KEYS) if (key in source) line[key] = source[key];
  const order: Record<string, unknown> = { lines: [line] };
  for (const key of ORDER_KEYS) if (key in source) order[key] = source[key];
  return order;
}

/** `createOrder` con la entrada de una receta. */
export function singleRecipeCreate<R>(
  createOrder: (input: unknown, actor: Actor | null | undefined) => Promise<R>,
): (input: unknown, actor: Actor | null | undefined) => Promise<R> {
  return (input, actor) => createOrder(singleLineInput(input), actor);
}

type LineReader = (orderId: string, scope: OrderScope) => Promise<readonly Pick<OrderLineRow, 'id'>[]>;

/** `updateOrder` con la entrada de una receta: edita la primera linea viva del pedido, la unica en
 *  un pedido creado con una receta. Sin actor o sin permiso de editar no se lee nada: el caso de uso
 *  lo rechaza antes de leer. */
export function singleRecipeUpdate(
  updateOrder: (id: string, input: unknown, actor: Actor | null | undefined) => Promise<void>,
  findAliveLines: LineReader,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<void> {
  return async (id, input, actor) => {
    const canEdit =
      actor !== null && actor !== undefined && Array.isArray(actor.permissions) && actor.permissions.includes('pedidos.modificar');
    const lines = canEdit ? await findAliveLines(id, { companyId: actor.companyId }) : [];
    return updateOrder(id, singleLineInput(input, lines[0]?.id), actor);
  };
}

/**
 * Las escrituras de un pedido de una receta vistas con los metodos del pedido que usaban los dobles
 * escritos antes de las lineas: bloquear las lineas es bloquear el pedido y su unica linea; editar
 * la linea llama a `updateAlive` con sus datos y su coste, y la prioridad y el cliente se le suman
 * despues; y estado, coste y plazo de la linea van a `setStatus`, `setIngredientsCost` y
 * `setReservedAt`. Derivar el estado y copiar la linea al pedido no hacen nada: el doble ya es el
 * pedido.
 */
export function singleRecipeWrites(orders: OrderWriteRepository): OrderWriteRepository {
  type Legacy = Record<string, (...args: unknown[]) => Promise<unknown>>;
  const legacy = orders as unknown as Legacy;
  let written: Record<string, unknown> | undefined;
  return {
    ...orders,
    lockAliveLines: async (id, scope) => {
      const order = await orders.lockAliveById(id, scope);
      return order === null ? null : { order, lines: [orderLineOf(order)] };
    },
    lockAliveLine: async (id, lineId, scope) => {
      const order = await orders.lockAliveById(id, scope);
      return order === null || lineId !== ONLY_LINE_ID ? null : { order, line: orderLineOf(order) };
    },
    writeLines: async (id, changes, actorId, now, scope) => {
      for (const edit of changes.edited) {
        written = { ...edit.line };
        delete written.originalRecipeId;
        const result = await legacy.updateAlive?.(id, written, actorId, now, edit.cost, scope);
        if (result === 'not_found') return null;
      }
      return changes.added.map((line, index) => ({
        ...orderLineOf({ ...fakeOrderRow({ id }), recipeId: line.recipeId, quantity: line.quantity, unitId: line.unitId }),
        id: `linea-${String(index)}`,
        position: index,
        status: line.status,
        salePrice: line.salePrice,
      }));
    },
    updateAlive: async (id, header, actorId, now, scope) => {
      if (written !== undefined) {
        Object.assign(written, header);
        return 'ok';
      }
      return (await legacy.updateAlive?.(id, { ...header }, actorId, now, 'keep', scope)) as 'ok' | 'not_found';
    },
    setLineStatus: async (id, _lineId, from, to, actorId, now, scope) => orders.setStatus(id, from, to, actorId, now, scope),
    setLineIngredientsCost: async (id, _lineId, cost, actorId, now, scope) =>
      orders.setIngredientsCost(id, cost, actorId, now, scope),
    setLineReservedAt: async (id, _lineId, reservedAt, scope) => orders.setReservedAt(id, reservedAt, scope),
    refreshStatus: async () => null,
    mirrorFirstLine: async () => undefined,
  };
}

function singleRecipeUnitOfWork(unitOfWork: OrderUnitOfWork): OrderUnitOfWork {
  return { run: (work) => unitOfWork.run((scope) => work({ ...scope, orders: singleRecipeWrites(scope.orders) })) };
}

/** Las lineas vivas que da un repositorio de lectura doble: la unica linea de la fila que lee. Lee
 *  con la implementacion del doble, sin contar otra llamada a `findAliveById`. */
function linesOfDouble(orders: OrderRepository): OrderRepository['findAliveLines'] {
  const double = orders.findAliveById as unknown as { getMockImplementation(): unknown };
  const read = vi.isMockFunction(orders.findAliveById)
    ? (double.getMockImplementation() as OrderRepository['findAliveById'] | undefined)
    : orders.findAliveById.bind(orders);
  // Si el doble falla al leer, el caso de uso lo vera fallar en su propia lectura.
  return async (id, scope) => {
    const row = await Promise.resolve()
      .then(() => read?.(id, scope))
      .catch(() => null);
    return row === null || row === undefined ? [] : [orderLineOf(row)];
  };
}

/** `createCreateOrder` para los tests con dobles escritos antes de las lineas: entrada de una receta
 *  y escrituras vistas como las del pedido. */
export function legacyCreateOrder(deps: CreateOrderDeps): ReturnType<typeof createCreateOrder> {
  return singleRecipeCreate(createCreateOrder({ ...deps, unitOfWork: singleRecipeUnitOfWork(deps.unitOfWork) }));
}

/** `createUpdateOrder` para los tests con dobles escritos antes de las lineas. */
export function legacyUpdateOrder(deps: UpdateOrderDeps): ReturnType<typeof createUpdateOrder> {
  const findAliveLines = linesOfDouble(deps.orders);
  const orders = { ...deps.orders, findAliveLines } as OrderRepository;
  return singleRecipeUpdate(
    createUpdateOrder({ ...deps, orders, unitOfWork: singleRecipeUnitOfWork(deps.unitOfWork) }),
    findAliveLines,
  );
}

type DistributionUpdate = ReturnType<typeof createUpdateOrderPresentationLines>;

/** La edicion acotada del reparto de un pedido de una receta: la de su unica linea, como la nombra
 *  el formulario de hoy. */
export function singleRecipeDistribution(
  update: DistributionUpdate,
  findAliveLines: LineReader,
): (
  orderId: string,
  actor: Actor,
  input: Omit<UpdateOrderPresentationLinesInput, 'lineId'>,
) => ReturnType<DistributionUpdate> {
  return async (orderId, actor, input) => {
    const [line] = await findAliveLines(orderId, { companyId: actor.companyId });
    return update(orderId, actor, { lineId: line?.id ?? ONLY_LINE_ID, ...input });
  };
}
