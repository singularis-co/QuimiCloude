// lib/modules/pedidos/domain/review-blocked-orders.ts
/**
 * Revisa las lineas `BLOQUEADO` de una empresa despues de que entre material y desbloquea las
 * que ya alcanzan: aparta, pasa la linea a `PENDIENTE`, fija su `reserved_at`, sustituye su importe
 * y deriva el estado del pedido.
 *
 * Por orden de alta de los pedidos y, dentro de cada pedido, por el de sus lineas, para que el
 * material que entra se aparte antes para la que lleva mas tiempo esperando. Cada linea va en su
 * propia transaccion: un fallo deja esa linea como estaba, queda en `failed` y la revision sigue
 * con la siguiente.
 *
 * Sin actor ni permiso, como la caducidad: lo dispara el sistema despues de una operacion de
 * inventario que ya exigio el suyo, y lo escrito queda sin autor.
 */
import { UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';

import { OrderNotFoundError } from './errors';
import { buildOrderRequirement, packagingLinesOf } from './order-requirement';
import { loadRequirementUnits } from './order-requirement-units';
import { resolveStoredOrderCost } from './resolve-ingredients-cost';

import type { OrderScope } from './order-scope';
import type { PackagingCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';
import type { OrderRepository } from '../ports/order-repository';
import type { OrderUnitOfWork } from '../ports/order-unit-of-work';

export type ReviewBlockedOrdersDeps = {
  readonly orders: Pick<OrderRepository, 'findBlockedIds' | 'findAliveLines'>;
  readonly recipes: RecipeCatalog;
  readonly products: ProductCatalog;
  readonly units: UnitCatalog;
  readonly packaging: PackagingCatalog;
  readonly unitOfWork: OrderUnitOfWork;
};

export type ReviewBlockedOrdersInput = {
  readonly companyId: string;
  readonly now: Date;
};

/** Sin mensaje ni datos del pedido: solo los identificadores y el codigo del catalogo. */
export type BlockedOrderReviewFailure = {
  readonly orderId: string;
  readonly lineId: string;
  readonly code: string;
};

export type ReviewBlockedOrdersResult = {
  /** Lineas que pasaron a `PENDIENTE`. */
  readonly unblocked: number;
  readonly failed: readonly BlockedOrderReviewFailure[];
};

function codeOf(error: unknown): string {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return UNEXPECTED_ERROR_CODE;
}

export function createReviewBlockedOrders(
  deps: ReviewBlockedOrdersDeps,
): (input: ReviewBlockedOrdersInput) => Promise<ReviewBlockedOrdersResult> {
  return async function reviewBlockedOrders(
    input: ReviewBlockedOrdersInput,
  ): Promise<ReviewBlockedOrdersResult> {
    const { companyId, now } = input;
    const scope: OrderScope = { companyId };

    const blocked = await deps.orders.findBlockedIds(scope);

    let unblocked = 0;
    const failed: BlockedOrderReviewFailure[] = [];

    for (const { orderId, lineId } of blocked) {
      try {
        if (await reviewOne(deps, orderId, lineId, scope, now)) unblocked += 1;
      } catch (e) {
        failed.push({ orderId, lineId, code: codeOf(e) });
      }
    }

    return { unblocked, failed };
  };
}

async function reviewOne(
  deps: ReviewBlockedOrdersDeps,
  orderId: string,
  lineId: string,
  scope: OrderScope,
  now: Date,
): Promise<boolean> {
  const line = (await deps.orders.findAliveLines(orderId, scope)).find((candidate) => candidate.id === lineId);
  if (line === undefined || line.status !== 'BLOQUEADO') return false;

  // Fuera de la transaccion, igual que en la edicion: la linea no tiene nada apartado, asi que es
  // el coste con el disponible general de este instante.
  const cost = await resolveStoredOrderCost(
    deps,
    line.recipeId,
    line.quantity,
    line.unitId,
    packagingLinesOf(line.presentationLines),
    scope.companyId,
    { orderLineId: lineId },
  );

  return deps.unitOfWork.run(async (transaction) => {
    const locked = await transaction.orders.lockAliveLine(orderId, lineId, scope);
    // Otra operacion la cancelo, la desbloqueo o la quito entre la lista y el candado. Si la
    // editaron sin desbloquearla, el importe calculado ya no es el suyo: se deja para la
    // siguiente revision.
    if (
      locked === null ||
      locked.line.status !== 'BLOQUEADO' ||
      locked.line.recipeId !== line.recipeId ||
      locked.line.quantity !== line.quantity ||
      locked.line.unitId !== line.unitId ||
      !samePackaging(locked.line.presentationLines, line.presentationLines)
    ) {
      return false;
    }

    const content = await transaction.recipes.findExecutionContentById(line.recipeId, scope.companyId);
    const recipeLines = content?.lines ?? [];
    const units = await loadRequirementUnits(
      transaction,
      recipeLines.map((recipeLine) => recipeLine.productId),
      line.unitId,
      scope.companyId,
    );
    const requirement = buildOrderRequirement({
      recipeLines,
      quantity: line.quantity,
      packagingLines: packagingLinesOf(line.presentationLines),
      phase: 'before_consumption',
      units,
    });
    // Entrar material no lo arregla: solo editar la unidad. Se queda bloqueada y sin tocar.
    if (requirement.kind === 'not_convertible') return false;

    const outcome = await transaction.reservations.syncForLine({
      orderId,
      orderLineId: lineId,
      companyId: scope.companyId,
      requirement: requirement.lines,
      actorId: null,
      now,
    });
    if (outcome.kind === 'insufficient') return false;

    const moved = await transaction.orders.setLineStatus(orderId, lineId, 'BLOQUEADO', 'PENDIENTE', null, now, scope);
    // Con la linea bloqueada no deberia pasar; si pasa, lanzar deshace lo apartado.
    if (moved !== 'ok') throw new OrderNotFoundError();

    const costed = await transaction.orders.setLineIngredientsCost(orderId, lineId, cost, null, now, scope);
    if (costed !== 'ok') throw new OrderNotFoundError();

    await transaction.orders.setLineReservedAt(orderId, lineId, outcome.kind === 'reserved' ? now : null, scope);
    await transaction.orders.refreshStatus(orderId, null, now, scope);
    await transaction.orders.mirrorFirstLine(orderId, scope);
    return true;
  });
}

function samePackaging(
  a: readonly { readonly packagingProductId: string | null; readonly packages: number }[],
  b: readonly { readonly packagingProductId: string | null; readonly packages: number }[],
): boolean {
  return JSON.stringify(packagingLinesOf(a)) === JSON.stringify(packagingLinesOf(b));
}
