import type { DataTableParams, DataTableTexts } from '@/components/shared/data-table';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/shared/pagination';
import { finishedProductDetailRoute } from '@/lib/shared/routes';

export const FINISHED_PRODUCT_TABS = [
  'general',
  'stock',
  'lotes',
  'entradas',
  'salidas',
  'entregas',
  'costo',
] as const;

export type FinishedProductTab = (typeof FINISHED_PRODUCT_TABS)[number];

export type FinishedProductListTab = Exclude<FinishedProductTab, 'general' | 'stock'>;

export const DEFAULT_FINISHED_PRODUCT_TAB: FinishedProductTab = 'general';

export const TAB_PARAM = 'tab';
export const PAGE_PARAM = 'page';
export const PAGE_SIZE_PARAM = 'pageSize';

const FIRST_PAGE = 1;
const PAGE_SIZES: readonly number[] = [DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE];

export type FinishedProductSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export type FinishedProductView = {
  readonly tab: FinishedProductTab;
  readonly page: number;
  readonly pageSize: number;
};

export type FinishedProductPaging = Pick<FinishedProductView, 'page' | 'pageSize'>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= FIRST_PAGE ? value : undefined;
}

export function isFinishedProductTab(value: string | undefined): value is FinishedProductTab {
  return FINISHED_PRODUCT_TABS.some((tab) => tab === value);
}

export function isFinishedProductListTab(tab: FinishedProductTab): tab is FinishedProductListTab {
  return tab !== 'general' && tab !== 'stock';
}

/** Ningún valor de la dirección produce un error: lo que no se entiende cae al defecto. */
export function parseFinishedProductParams(
  searchParams: FinishedProductSearchParams | undefined,
): FinishedProductView {
  const rawTab = firstValue(searchParams?.[TAB_PARAM]);
  const page = parsePositiveInt(firstValue(searchParams?.[PAGE_PARAM]));
  const pageSize = parsePositiveInt(firstValue(searchParams?.[PAGE_SIZE_PARAM]));

  return {
    tab: isFinishedProductTab(rawTab) ? rawTab : DEFAULT_FINISHED_PRODUCT_TAB,
    page: page ?? FIRST_PAGE,
    pageSize: pageSize !== undefined && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

/** Cambiar de tab no arrastra la página: el tab nuevo abre en la primera. */
export function finishedProductTabHref(productId: string, tab: FinishedProductTab): string {
  const query = new URLSearchParams({ [TAB_PARAM]: tab });
  return `${finishedProductDetailRoute(productId)}?${query.toString()}`;
}

export function finishedProductPageHref(
  productId: string,
  tab: FinishedProductListTab,
  paging: FinishedProductPaging,
): string {
  const query = new URLSearchParams({
    [TAB_PARAM]: tab,
    [PAGE_PARAM]: String(paging.page),
    [PAGE_SIZE_PARAM]: String(paging.pageSize),
  });
  return `${finishedProductDetailRoute(productId)}?${query.toString()}`;
}

/** Los listados de la ficha no ordenan, no filtran ni buscan. */
export function finishedProductTableParams(paging: FinishedProductPaging): DataTableParams {
  return { page: paging.page, pageSize: paging.pageSize, sort: null, filters: {}, search: '' };
}

export const FINISHED_PRODUCT_TABLE_TEXTS: DataTableTexts = {
  empty: 'No hay filas que mostrar.',
  loading: 'Cargando…',
  error: 'No se pudo cargar el listado.',
  search: 'Buscar',
  filters: 'Filtros',
  columnMenu: 'opciones de la columna',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageIndicator: (page, totalPages) => `Página ${page} de ${totalPages}`,
  pageSize: 'Filas por página',
  sortAscending: 'Orden ascendente',
  sortDescending: 'Orden descendente',
  pinColumn: 'Fijar columna',
  unpinColumn: 'Soltar columna',
  filterColumn: 'Filtrar columna',
  clearFilter: 'Limpiar filtro',
  lastWeek: 'Última semana',
  lastMonth: 'Último mes',
  lastYear: 'Último año',
};
