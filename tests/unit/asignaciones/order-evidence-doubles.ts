// Montaje comun de la lectura de fotos de un pedido: el catalogo de pedidos (que solo devuelve el
// pedido a su empresa, vivo o dado de baja), el repositorio de fotos en memoria y el bucket.
import { vi } from 'vitest';

import { bucket, EMPRESA, PEDIDO, repositorioEnMemoria, filaFoto, funcionesDe } from './evidence-doubles';

import type { ReadOrderEvidenceDeps } from '@/lib/modules/asignaciones/domain/read-order-evidence';
import type { OrderCatalog, OrderHistorySummary, OrderStatus } from '@/lib/modules/pedidos';

export function pedido(overrides?: Partial<OrderHistorySummary>): OrderHistorySummary {
  return { id: PEDIDO, number: { year: 2026, sequence: 42 }, status: 'ENTREGADO', deleted: false, ...overrides };
}

export function montarLectura(options?: {
  readonly pedido?: OrderHistorySummary | null;
  readonly filas?: Parameters<typeof repositorioEnMemoria>[0];
  readonly firmaFalla?: Error;
}) {
  const resumen = options?.pedido === undefined ? pedido() : options.pedido;
  const listSummariesByIdsIncludingDeleted = vi.fn(
    async (companyId: string, ids: readonly string[], _statuses: readonly OrderStatus[], page: number) => {
      const items =
        resumen !== null && companyId === EMPRESA && ids.includes(resumen.id) ? [resumen] : [];
      return { items, total: items.length, page, pageSize: 1, totalPages: 1 };
    },
  );
  const orders = { listSummariesByIdsIncludingDeleted } as unknown as OrderCatalog;
  const { repo } = repositorioEnMemoria(options?.filas ?? []);
  const storage = bucket();
  if (options?.firmaFalla !== undefined) storage.createSignedReadUrls.mockRejectedValue(options.firmaFalla);

  const deps: ReadOrderEvidenceDeps = { orders, evidence: repo, storage };
  const puertos = [listSummariesByIdsIncludingDeleted, ...funcionesDe(repo), ...funcionesDe(storage)];
  return {
    deps,
    listSummariesByIdsIncludingDeleted,
    repo,
    storage,
    ningunPuertoLlamado: () => puertos.every((fn) => fn.mock.calls.length === 0),
  };
}

/** Fabricacion en los pasos 1 (2 fotos) y 3 (1); envasado en el paso 1 (1). */
export const FILAS_DEL_PEDIDO = [
  filaFoto({ id: 'm1-2', slot: 2, stepPosition: 1 }),
  filaFoto({ id: 'm3-1', slot: 1, stepPosition: 3 }),
  filaFoto({ id: 'm1-1', slot: 1, stepPosition: 1 }),
  filaFoto({ id: 'p1-1', slot: 1, stepPosition: 1, phase: 'packing' }),
];
