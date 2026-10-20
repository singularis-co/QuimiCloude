import type { ListQueryable } from './list-query';

// `status` es un nombre de filtro y no una columna: la marca de baja sigue sin ser consultable.
export const COMPANY_QUERYABLE: ListQueryable = {
  sortable: ['name', 'createdAt'],
  filterable: { status: 'select' },
  searchable: true,
};

export const COMPANY_STATUSES = ['active', 'deleted'] as const;
