/**
 * Agrupado y filtro de personas que comparten los responsables de un pedido y el equipo de
 * acondicionamiento. Repite la forma del origen en vez de importarla: `lib/shared` no depende de
 * ningun modulo de dominio, y un test de tipos ata las dos formas.
 */

export type ResponsibleOrigin =
  | { readonly kind: 'direct' }
  | { readonly kind: 'workGroup'; readonly workGroupId: string; readonly workGroupName: string };

export type ResponsibleGroup<T extends { readonly origin: ResponsibleOrigin }> =
  | { readonly kind: 'direct'; readonly responsibles: readonly T[] }
  | {
      readonly kind: 'workGroup';
      readonly workGroupId: string;
      readonly workGroupName: string;
      readonly responsibles: readonly T[];
    };

/**
 * Los grupos salen en el orden de su primera aparicion: la lista ya llega en un orden estable del
 * servidor y reordenar aqui seria un segundo criterio que podria discrepar del suyo. El nombre del
 * grupo es el congelado en cada fila, no el actual del catalogo.
 */
export function groupResponsiblesByOrigin<T extends { readonly origin: ResponsibleOrigin }>(
  responsibles: readonly T[],
): readonly ResponsibleGroup<T>[] {
  const direct: T[] = [];
  const byWorkGroup = new Map<string, { name: string; responsibles: T[] }>();
  const order: string[] = [];

  for (const responsible of responsibles) {
    if (responsible.origin.kind === 'direct') {
      direct.push(responsible);
      continue;
    }

    const { workGroupId, workGroupName } = responsible.origin;
    const existing = byWorkGroup.get(workGroupId);
    if (existing === undefined) {
      order.push(workGroupId);
      byWorkGroup.set(workGroupId, { name: workGroupName, responsibles: [responsible] });
      continue;
    }
    existing.responsibles.push(responsible);
  }

  const groups: ResponsibleGroup<T>[] = [];
  if (direct.length > 0) {
    groups.push({ kind: 'direct', responsibles: direct });
  }
  for (const workGroupId of order) {
    const group = byWorkGroup.get(workGroupId);
    if (group === undefined) continue;
    groups.push({
      kind: 'workGroup',
      workGroupId,
      workGroupName: group.name,
      responsibles: group.responsibles,
    });
  }

  return groups;
}

export function filterByDisplayName<T extends { readonly displayName: string }>(
  items: readonly T[],
  search: string,
): readonly T[] {
  const term = search.trim().toLocaleLowerCase();
  return term === ''
    ? items
    : items.filter((item) => item.displayName.toLocaleLowerCase().includes(term));
}
