import {
  PAGE_SIZE_OPTIONS,
  type DataTableFilterValue,
  type DataTableParams,
  type DataTableSort,
} from '@/components/shared/data-table';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';
import { MAESTRO_COMPANIES_ROUTE } from '@/lib/shared/routes';

// Sin React ni `next/*`: la página lo lee en el servidor. Lo desconocido se ignora en vez de
// rechazarse, para que una dirección vieja o tecleada a mano siga dando una lista.

export const PAGE_PARAM = 'page';
export const PAGE_SIZE_PARAM = 'pageSize';
export const SORT_PARAM = 'sort';
export const DIR_PARAM = 'dir';
export const SEARCH_PARAM = 'q';
export const STATUS_PARAM = 'estado';

export const NAME_COLUMN_ID = 'name';
export const CREATED_AT_COLUMN_ID = 'createdAt';
export const STATUS_COLUMN_ID = 'status';

export const COMPANY_SORTABLE_COLUMNS = [NAME_COLUMN_ID, CREATED_AT_COLUMN_ID] as const;

export const FIRST_PAGE = 1;

export type CompanyStatusValue = 'active' | 'deleted';

const STATUS_URL_VALUES: Readonly<Record<CompanyStatusValue, string>> = {
  active: 'activa',
  deleted: 'de-baja',
};

const STATUS_ORDER: readonly CompanyStatusValue[] = ['active', 'deleted'];

const STATUS_SEPARATOR = ',';

export type CompanyListSearchParams = Readonly<
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

function isSortableColumn(value: string): boolean {
  return COMPANY_SORTABLE_COLUMNS.some((columnId) => columnId === value);
}

function parseSort(rawColumn: string | undefined, rawDir: string | undefined): DataTableSort | null {
  if (rawColumn === undefined || !isSortableColumn(rawColumn)) return null;
  const direction = rawDir === 'desc' ? 'desc' : 'asc';
  return { columnId: rawColumn, direction };
}

function parseStatuses(raw: string | undefined): readonly CompanyStatusValue[] {
  if (raw === undefined) return [];
  const parts = raw.split(STATUS_SEPARATOR).map((part) => part.trim());
  return STATUS_ORDER.filter((status) => parts.includes(STATUS_URL_VALUES[status]));
}

export function parseCompanyListParams(
  searchParams: CompanyListSearchParams | undefined,
): DataTableParams {
  const rawPage = parsePositiveInt(firstValue(searchParams?.[PAGE_PARAM]));
  const rawPageSize = parsePositiveInt(firstValue(searchParams?.[PAGE_SIZE_PARAM]));
  const statuses = parseStatuses(firstValue(searchParams?.[STATUS_PARAM]));

  const filters: Record<string, DataTableFilterValue> = {};
  if (statuses.length > 0) filters[STATUS_COLUMN_ID] = { kind: 'select', values: statuses };

  return {
    page: rawPage === undefined || rawPage < FIRST_PAGE ? FIRST_PAGE : rawPage,
    pageSize: rawPageSize !== undefined && isPageSize(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE,
    sort: parseSort(firstValue(searchParams?.[SORT_PARAM]), firstValue(searchParams?.[DIR_PARAM])),
    filters,
    search: (firstValue(searchParams?.[SEARCH_PARAM]) ?? '').trim(),
  };
}

export function statusFilterValues(params: DataTableParams): readonly CompanyStatusValue[] {
  const filter = params.filters[STATUS_COLUMN_ID];
  if (filter?.kind !== 'select') return [];
  return STATUS_ORDER.filter((status) => filter.values.includes(status));
}

// Sin claves vacías: `?q=` haría creer que la lista está filtrada.
export function buildCompanyListQuery(params: DataTableParams): string {
  const query = new URLSearchParams();
  query.set(PAGE_PARAM, String(params.page));
  query.set(PAGE_SIZE_PARAM, String(params.pageSize));

  if (params.sort !== null && isSortableColumn(params.sort.columnId)) {
    query.set(SORT_PARAM, params.sort.columnId);
    query.set(DIR_PARAM, params.sort.direction);
  }

  if (params.search !== '') query.set(SEARCH_PARAM, params.search);

  const statuses = statusFilterValues(params);
  if (statuses.length > 0) {
    query.set(STATUS_PARAM, statuses.map((status) => STATUS_URL_VALUES[status]).join(STATUS_SEPARATOR));
  }

  return query.toString();
}

export function companyListHref(params: DataTableParams): string {
  return `${MAESTRO_COMPANIES_ROUTE}?${buildCompanyListQuery(params)}`;
}

export function isDeletedOnlyFilter(params: DataTableParams): boolean {
  const statuses = statusFilterValues(params);
  return statuses.length === 1 && statuses[0] === 'deleted';
}

export function withoutStatusFilter(params: DataTableParams): DataTableParams {
  const filters = Object.fromEntries(
    Object.entries(params.filters).filter(([columnId]) => columnId !== STATUS_COLUMN_ID),
  );
  return { ...params, filters, page: FIRST_PAGE };
}

export function withoutSearch(params: DataTableParams): DataTableParams {
  return { ...params, search: '', page: FIRST_PAGE };
}

function filtersEqual(a: DataTableParams['filters'], b: DataTableParams['filters']): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Una búsqueda o un filtro nuevos son sobre el conjunto completo: vuelven a la primera página. */
export function withSearchResetsPage(
  current: DataTableParams,
  next: DataTableParams,
): DataTableParams {
  const changed = current.search !== next.search || !filtersEqual(current.filters, next.filters);
  return changed ? { ...next, page: FIRST_PAGE } : next;
}
