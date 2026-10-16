import type { ListQueryable } from './list-query';

export const ADMINISTRATOR_QUERYABLE: ListQueryable = {
  sortable: ['lastNames', 'firstNames', 'username', 'email', 'accountStatus', 'createdAt', 'companyName'],
  filterable: { companyId: 'select' },
  searchable: true,
};
