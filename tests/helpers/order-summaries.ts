// Las lecturas de resumen de `OrderCatalog` cableadas como en `lib/composition`: adaptadores
// reales de `pedidos` y catalogo de envases real de `inventario`.
import {
  findPackagingCostingBatches,
  findPackagingRefs,
} from '@/lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma';
import {
  createFindAliveLineSummary,
  createListAliveSummariesByIds,
  createListAliveSummariesInCompany,
  createListSummariesByIdsIncludingDeleted,
  type OrderCatalog,
} from '@/lib/modules/pedidos';
import {
  findAliveOrderLineSummary,
  listAliveOrderSummariesByIds,
  listAliveOrderSummariesInCompany,
  listOrderHistoryByIdsIncludingDeleted,
  listOrderNumbersByIdsIncludingDeleted,
  listOrderRecipeOutlinesByIdsIncludingDeleted,
} from '@/lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma';

export function realOrderSummaries(): Pick<
  OrderCatalog,
  | 'listAliveSummariesByIds'
  | 'listAliveSummariesInCompany'
  | 'listSummariesByIdsIncludingDeleted'
  | 'findAliveLineSummary'
  | 'listRecipeOutlinesByIdsIncludingDeleted'
> {
  const deps = {
    summaries: {
      listAliveByIds: listAliveOrderSummariesByIds,
      findAliveLine: findAliveOrderLineSummary,
      listAliveInCompany: listAliveOrderSummariesInCompany,
      listNumbersByIdsIncludingDeleted: listOrderNumbersByIdsIncludingDeleted,
      listHistoryByIdsIncludingDeleted: listOrderHistoryByIdsIncludingDeleted,
    },
    packaging: { findRefs: findPackagingRefs, findCostingBatches: findPackagingCostingBatches },
  };
  return {
    listAliveSummariesByIds: createListAliveSummariesByIds(deps),
    listAliveSummariesInCompany: createListAliveSummariesInCompany(deps),
    listSummariesByIdsIncludingDeleted: createListSummariesByIdsIncludingDeleted(deps),
    findAliveLineSummary: createFindAliveLineSummary(deps),
    listRecipeOutlinesByIdsIncludingDeleted: listOrderRecipeOutlinesByIdsIncludingDeleted,
  };
}
