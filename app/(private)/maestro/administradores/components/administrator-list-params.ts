import { z } from 'zod';

import {
  PAGE_SIZE_OPTIONS,
  type DataTableFilterValue,
  type DataTableParams,
} from '@/components/shared/data-table';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';
import { MAESTRO_ADMINISTRATORS_ROUTE } from '@/lib/shared/routes';

// Sin React ni `next/*`: la página lo lee en el servidor. Lo desconocido se ignora en vez de
// rechazarse, para que una dirección vieja o tecleada a mano siga dando una lista.

export const ADMINISTRATOR_PAGE_PARAM = 'page';
export const ADMINISTRATOR_PAGE_SIZE_PARAM = 'pageSize';
export const ADMINISTRATOR_COMPANY_PARAM = 'empresa';

export const ADMINISTRATOR_NAME_COLUMN_ID = 'name';
export const ADMINISTRATOR_USERNAME_COLUMN_ID = 'username';
export const ADMINISTRATOR_EMAIL_COLUMN_ID = 'email';
/** El mismo nombre que el filtro de la acción: `DataTable` filtra por el id de la columna. */
export const ADMINISTRATOR_COMPANY_COLUMN_ID = 'companyId';
export const ADMINISTRATOR_STATUS_COLUMN_ID = 'accountStatus';

export const ADMINISTRATOR_FIRST_PAGE = 1;

const COMPANY_SEPARATOR = ',';

const companyIdSchema = z.string().uuid();

export type AdministratorListSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

// Se comprueba el texto y no el número: `Number` acepta `'1.5'`, `'1e3'` y `' 2 '`.
function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : undefined;
}

function isPageSize(value: number): boolean {
  return PAGE_SIZE_OPTIONS.some((option) => option === value);
}

function parseCompanyIds(raw: string | undefined): readonly string[] {
  if (raw === undefined) return [];
  const ids = raw
    .split(COMPANY_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => companyIdSchema.safeParse(part).success);
  return [...new Set(ids)];
}

export function parseAdministratorListParams(
  searchParams: AdministratorListSearchParams | undefined,
): DataTableParams {
  const rawPage = parsePositiveInt(firstValue(searchParams?.[ADMINISTRATOR_PAGE_PARAM]));
  const rawPageSize = parsePositiveInt(firstValue(searchParams?.[ADMINISTRATOR_PAGE_SIZE_PARAM]));
  const companyIds = parseCompanyIds(firstValue(searchParams?.[ADMINISTRATOR_COMPANY_PARAM]));

  const filters: Record<string, DataTableFilterValue> = {};
  if (companyIds.length > 0) {
    filters[ADMINISTRATOR_COMPANY_COLUMN_ID] = { kind: 'select', values: companyIds };
  }

  return {
    page:
      rawPage === undefined || rawPage < ADMINISTRATOR_FIRST_PAGE
        ? ADMINISTRATOR_FIRST_PAGE
        : rawPage,
    pageSize: rawPageSize !== undefined && isPageSize(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE,
    sort: null,
    filters,
    search: '',
  };
}

export function companyFilterValues(params: DataTableParams): readonly string[] {
  const filter = params.filters[ADMINISTRATOR_COMPANY_COLUMN_ID];
  return filter?.kind === 'select' ? filter.values : [];
}

export function buildAdministratorListQuery(params: DataTableParams): string {
  const query = new URLSearchParams();
  query.set(ADMINISTRATOR_PAGE_PARAM, String(params.page));
  query.set(ADMINISTRATOR_PAGE_SIZE_PARAM, String(params.pageSize));

  const companyIds = companyFilterValues(params);
  if (companyIds.length > 0) {
    query.set(ADMINISTRATOR_COMPANY_PARAM, companyIds.join(COMPANY_SEPARATOR));
  }

  return query.toString();
}

export function administratorListHref(params: DataTableParams): string {
  return `${MAESTRO_ADMINISTRATORS_ROUTE}?${buildAdministratorListQuery(params)}`;
}

export function withoutCompanyFilter(params: DataTableParams): DataTableParams {
  const filters = Object.fromEntries(
    Object.entries(params.filters).filter(
      ([columnId]) => columnId !== ADMINISTRATOR_COMPANY_COLUMN_ID,
    ),
  );
  return { ...params, filters, page: ADMINISTRATOR_FIRST_PAGE };
}

/** Un filtro nuevo es sobre el conjunto completo: vuelve a la primera página. */
export function withFilterResetsPage(
  current: DataTableParams,
  next: DataTableParams,
): DataTableParams {
  const changed = JSON.stringify(current.filters) !== JSON.stringify(next.filters);
  return changed ? { ...next, page: ADMINISTRATOR_FIRST_PAGE } : next;
}
