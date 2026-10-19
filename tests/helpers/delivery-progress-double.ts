// Doble de `OrderCatalog['listDeliveryProgressByIdsIncludingDeleted']` para los tests unitarios
// de `pedidos`: devuelve solo el progreso de los ids pedidos, como el adaptador real.
import { vi } from 'vitest';

import type { OrderDeliveryProgress } from '@/lib/modules/pedidos';

export function fakeDeliveryProgress(progress: readonly OrderDeliveryProgress[] = []) {
  const listDeliveryProgressByIdsIncludingDeleted = vi.fn(
    async (companyId: string, ids: readonly string[]): Promise<readonly OrderDeliveryProgress[]> => {
      void companyId;
      return progress.filter((order) => ids.includes(order.id));
    },
  );
  return { listDeliveryProgressByIdsIncludingDeleted };
}
