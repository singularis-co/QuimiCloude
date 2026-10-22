import type { ErrorState } from '@/lib/modules/errores';
import { listCompaniesAction } from '@/lib/modules/identity/adapters/driving/company-actions';
import { MAX_PAGE_SIZE } from '@/lib/shared/pagination';

export type ActiveCompany = { readonly id: string; readonly name: string };

export type ActiveCompaniesResult =
  | { readonly status: 'success'; readonly companies: readonly ActiveCompany[] }
  | ErrorState;

/**
 * Todas las empresas activas, por nombre, para el filtro «Empresa» y el alta. Sin filtro de estado
 * la acción ya da solo las activas.
 */
export async function loadActiveCompanies(): Promise<ActiveCompaniesResult> {
  const companies: ActiveCompany[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await listCompaniesAction({
      page,
      pageSize: MAX_PAGE_SIZE,
      sort: { columnId: 'name', direction: 'asc' },
      filters: {},
      search: '',
    });
    if (result.status === 'error') return result;
    companies.push(...result.data.items.map(({ id, name }) => ({ id, name })));
    totalPages = result.data.totalPages;
    page += 1;
  } while (page <= totalPages);

  return { status: 'success', companies };
}
