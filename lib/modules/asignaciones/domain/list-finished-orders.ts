// lib/modules/asignaciones/domain/list-finished-orders.ts
/**
 * «Terminados». Quien ejecuta pedidos ve los `TERMINADO` de la empresa, por fecha de terminado.
 * Quien no ejecuta (el empacador) ve lo que empaco el mismo y ya salio de empaque:
 * `POR_ACONDICIONAR`, `EN_ACONDICIONAMIENTO` o `TERMINADO`, con los aun sin fecha de terminado
 * primero. La composicion de responsables no descarta al actor, porque aqui no hay un «yo» al
 * que restar de la lista.
 */
import { z } from 'zod';

import { canExecuteAssignedOrders, requirePermission, type Actor } from './actor';
import { composeOrderRows, type ComposeOrderRowsDeps } from './compose-order-rows';
import { ValidationError } from './errors';

import type { FinishedOrderView } from './finished-order-view';

import { formatOrderNumber, type OrderCatalog, type OrderStatus, type Page } from '@/lib/modules/pedidos';

/** Lo que el empacador ya saco de empaque: en acondicionamiento o terminado. */
const PACKED_STATUSES: readonly OrderStatus[] = ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'];

const listFinishedOrdersSchema = z.strictObject({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),
});

export type ListFinishedOrdersDeps = ComposeOrderRowsDeps & {
  readonly orders: OrderCatalog;
};

export function createListFinishedOrders(
  deps: ListFinishedOrdersDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<Page<FinishedOrderView>> {
  return async function listFinishedOrders(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<Page<FinishedOrderView>> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'terminados.consultar');

    const parsed = listFinishedOrdersSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { page, pageSize } = parsed.data;

    // Quien no ejecuta pedidos solo ve los que empaco el mismo, tambien los que siguen en
    // acondicionamiento (sin fecha de terminado). El filtro va en la consulta para que `total` y
    // la paginacion describan lo que se muestra.
    const ordersPage = canExecuteAssignedOrders(actor)
      ? await deps.orders.listAliveSummariesInCompany(
          actor.companyId,
          ['TERMINADO'],
          'finished_recent_first',
          page,
          pageSize,
          undefined,
        )
      : await deps.orders.listAliveSummariesInCompany(
          actor.companyId,
          PACKED_STATUSES,
          'unfinished_then_recent',
          page,
          pageSize,
          { packedBy: actor.id },
        );

    const composed = await composeOrderRows(deps, actor.companyId, ordersPage.items);

    const items: FinishedOrderView[] = ordersPage.items.map((row) => {
      const rowComposed = composed.get(row.id);
      return {
        id: row.id,
        numberText: formatOrderNumber(row.number),
        recipeName: rowComposed?.recipeName ?? null,
        quantity: row.quantity,
        presentationLines: rowComposed?.presentationLines ?? [],
        unitId: row.unitId,
        unitLabel: rowComposed?.unitLabel ?? null,
        finishedAt: row.finishedAt,
        responsibles: rowComposed?.responsibles ?? [],
      };
    });

    return {
      items,
      total: ordersPage.total,
      page: ordersPage.page,
      pageSize: ordersPage.pageSize,
      totalPages: ordersPage.totalPages,
    };
  };
}
