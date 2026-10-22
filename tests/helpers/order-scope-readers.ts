// Las lecturas de productos, unidades y consumos del `OrderTransactionScope`, atadas al `tx` igual que en
// `lib/composition > orderUnitOfWork`. Los tests de integracion que arman su propio scope las
// toman de aqui para no repetir el cableado.
import type { Prisma } from '@prisma/client';

import { createOrderConsumptionLedger } from '@/lib/modules/inventario/adapters/driven/persistence/order-consumption-prisma';
import { findProductRefs } from '@/lib/modules/inventario/adapters/driven/persistence/product-catalog-prisma';
import type { OrderTransactionScope } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import { createUnitCatalogReader } from '@/lib/modules/unidades/adapters/driven/persistence/unit-catalog-prisma';

export function orderScopeReaders(
  tx: Prisma.TransactionClient,
): Pick<OrderTransactionScope, 'products' | 'units' | 'consumption'> {
  return {
    products: { findRefs: (ids, companyId) => findProductRefs(ids, companyId, tx) },
    units: createUnitCatalogReader(tx),
    consumption: createOrderConsumptionLedger(tx),
  };
}
