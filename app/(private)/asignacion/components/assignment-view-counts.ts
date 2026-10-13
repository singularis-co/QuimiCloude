import type { AssignmentViewKind } from '@/lib/modules/asignaciones';

import type { AssignmentViewCounts } from './assignment-view-tabs';

/** La primera página sin filtros: de ella solo se lee `total`. */
export const VIEW_COUNT_QUERY = { page: 1, pageSize: 1 } as const;

export type ViewCountReader = (
  query: typeof VIEW_COUNT_QUERY,
) => Promise<{ readonly total: number }>;

export type ViewCountReaders = Readonly<Record<AssignmentViewKind, ViewCountReader>>;

export function toViewCounts(
  views: readonly AssignmentViewKind[],
  results: readonly PromiseSettledResult<{ readonly total: number }>[],
): AssignmentViewCounts {
  const counts: Partial<Record<AssignmentViewKind, number>> = {};
  views.forEach((view, index) => {
    const result = results[index];
    if (result?.status === 'fulfilled') counts[view] = result.value.total;
  });
  return counts;
}

/**
 * Un contador que no se puede leer no es motivo para tumbar las pestañas ni la lista: esa vista se
 * pinta sin número, y su propia lista mostrará el error si lo hay.
 */
export async function readViewCounts(
  views: readonly AssignmentViewKind[],
  readers: ViewCountReaders,
): Promise<AssignmentViewCounts> {
  const results = await Promise.allSettled(
    views.map(async (view) => readers[view](VIEW_COUNT_QUERY)),
  );
  return toViewCounts(views, results);
}
