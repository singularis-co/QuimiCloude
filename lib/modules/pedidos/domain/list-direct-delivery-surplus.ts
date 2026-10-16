import { requirePermission, type Actor } from './actor';
import { ActionNotAllowedError } from './errors';

import type { WaitingOrdersReader } from '../ports/direct-delivery-repository';

import type { FinishedProductDeliveryCatalog } from '@/lib/modules/inventario';

export type ListDirectDeliverySurplusDeps = {
  readonly catalog: Pick<FinishedProductDeliveryCatalog, 'findSurplusBases'>;
  readonly waiting: WaitingOrdersReader;
};

/** El excedente de cada producto terminado de una pagina del listado, con dos lecturas en total. */
export function createListDirectDeliverySurplus(
  deps: ListDirectDeliverySurplusDeps,
): (productIds: unknown, actor: Actor | null | undefined) => Promise<ReadonlyMap<string, number>> {
  void deps;
  return async function listDirectDeliverySurplus(productIds, actor) {
    requirePermission(actor, 'entregas.modificar');
    void productIds;
    throw new ActionNotAllowedError('listDirectDeliverySurplus sin implementar');
  };
}
