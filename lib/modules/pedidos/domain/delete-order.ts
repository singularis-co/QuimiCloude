import { requirePermission, type Actor } from './actor';
import { NotDeletableError, OrderNotFoundError } from './errors';
import type { OrderStatus } from './order-classification';
import type { OrderScope } from './order-scope';

import type { OrderUnitOfWork } from '../ports/order-unit-of-work';
import type { OrderRepository } from '../ports/order-repository';

export type DeleteOrderDeps = {
  readonly orders: OrderRepository;
  /** Borrar tambien solo libera: mismo motivo que `CancelOrderDeps` para no recibir la receta. */
  readonly unitOfWork: OrderUnitOfWork;
  /** Ver el comentario identico de `create-order.ts` sobre el origen de este reloj. */
  readonly now?: () => Date;
};

/**
 * Los estados que NO se borran: se cancela, se termina o se entrega para dejar constancia, asi
 * que borrar despues los borraria de las consultas. Desde `POR_EMPACAR` el material ya se
 * consumio -borrarlos ocultaria ese consumo y el producto terminado ya dado de alta-. Esta lista
 * es la mitad de APLICACION; la otra mitad es el `CHECK orders_delivered_not_deleted`, que
 * nombra los mismos estados.
 */
const NO_BORRABLES: readonly OrderStatus[] = [
  'ENTREGADO',
  'CANCELADO',
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
];

/** Se borra solo si el pedido y cada una de sus lineas vivas estan en un estado borrable. */
function isDeletable(status: OrderStatus, lines: readonly { readonly status: OrderStatus }[]): boolean {
  return !NO_BORRABLES.includes(status) && lines.every((line) => !NO_BORRABLES.includes(line.status));
}

/**
 * Borrado de pedido. Borrado LOGICO y sin restaurar: `softDeleteAlive`, jamas un borrado
 * fisico. El pedido conserva su fila entera y su numero correlativo -que no se libera ni se
 * reutiliza- y solo gana `deleted_at`.
 *
 * No existe ninguna operacion de restaurar ni ningun listado de borrados, y no por olvido:
 * el puerto no las declara, asi que no se pueden hacer por descuido.
 *
 * Un pedido vivo que se borra da de baja tambien todas sus lineas y libera el material de cada
 * una, en la MISMA transaccion, con el actor que borro como autor.
 */
export function createDeleteOrder(
  deps: DeleteOrderDeps,
): (id: string, actor: Actor | null | undefined) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function deleteOrder(
    id: string,
    actor: Actor | null | undefined,
  ): Promise<void> {
    requirePermission(actor, 'pedidos.modificar');

    // La empresa sale del ACTOR y jamas de la entrada: nadie puede elegir consultar otra.
    const scope: OrderScope = { companyId: actor.companyId };

    // No existe y ya esta borrado son el mismo caso; el filtro `deleted_at IS NULL` es del puerto.
    // Se lee antes de escribir para distinguir «no existe» de «no se puede borrar».
    const row = await deps.orders.findAliveById(id, scope);
    if (row === null) throw new OrderNotFoundError();
    const lines = await deps.orders.findAliveLines(id, scope);
    if (!isDeletable(row.status, lines)) throw new NotDeletableError();

    const instant = now();

    const result = await deps.unitOfWork.run(async (transaction) => {
      const locked = await transaction.orders.lockAliveLines(id, scope);
      if (locked === null) return 'not_found' as const;
      if (!isDeletable(locked.order.status, locked.lines)) throw new NotDeletableError();

      // Libera y vacia los plazos ANTES de marcar `deleted_at`: esas escrituras solo tocan filas
      // vivas, asi que despues del borrado no tocarian nada.
      for (const line of locked.lines) {
        await transaction.reservations.releaseForLine({
          orderId: id,
          orderLineId: line.id,
          companyId: actor.companyId,
          reason: 'release',
          actorId: actor.id,
          now: instant,
        });
        await transaction.orders.setLineReservedAt(id, line.id, null, scope);
      }

      const deleted = await transaction.orders.softDeleteAlive(id, actor.id, instant, scope);
      if (deleted === 'not_found') return 'not_found' as const;
      return 'ok' as const;
    });

    if (result === 'not_found') throw new OrderNotFoundError();
  };
}
