import { describe, expect, it } from 'vitest';

import {
  buildCompanyListQuery,
  companyListHref,
  isDeletedOnlyFilter,
  parseCompanyListParams,
  withSearchResetsPage,
  withoutSearch,
  withoutStatusFilter,
} from '@/app/(private)/maestro/empresas/components/company-list-params';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';
import { MAESTRO_COMPANIES_ROUTE } from '@/lib/shared/routes';

describe('parametros de la lista de empresas', () => {
  it('R9: sin estado en la direccion no hay filtro (el servidor da solo activas)', () => {
    const params = parseCompanyListParams({});
    expect(params).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: null,
      filters: {},
      search: '',
    });
  });

  it('R9: «activa», «de-baja» o los dos se traducen al filtro select de status', () => {
    expect(parseCompanyListParams({ estado: 'activa' }).filters).toEqual({
      status: { kind: 'select', values: ['active'] },
    });
    expect(parseCompanyListParams({ estado: 'de-baja' }).filters).toEqual({
      status: { kind: 'select', values: ['deleted'] },
    });
    expect(parseCompanyListParams({ estado: 'de-baja,activa' }).filters).toEqual({
      status: { kind: 'select', values: ['active', 'deleted'] },
    });
  });

  it('R9: un estado desconocido se ignora', () => {
    expect(parseCompanyListParams({ estado: 'borrada' }).filters).toEqual({});
  });

  it('R10: la busqueda se lee de q, sin espacios de los extremos', () => {
    expect(parseCompanyListParams({ q: '  900.481 ' }).search).toBe('900.481');
  });

  it('R11: orden por Nombre o por Creada con su direccion; otra columna se ignora', () => {
    expect(parseCompanyListParams({ sort: 'name', dir: 'desc' }).sort).toEqual({
      columnId: 'name',
      direction: 'desc',
    });
    expect(parseCompanyListParams({ sort: 'createdAt' }).sort).toEqual({
      columnId: 'createdAt',
      direction: 'asc',
    });
    expect(parseCompanyListParams({ sort: 'taxId', dir: 'asc' }).sort).toBeNull();
  });

  it('R11: pagina y tamano fuera de rango caen a los valores por defecto', () => {
    const params = parseCompanyListParams({ page: '0', pageSize: '7' });
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseCompanyListParams({ page: '1.5' }).page).toBe(1);
  });

  it('R11: la direccion conserva pagina, tamano, orden, filtro y busqueda (ida y vuelta)', () => {
    const original = {
      page: 3,
      pageSize: 25,
      sort: { columnId: 'createdAt', direction: 'desc' as const },
      filters: { status: { kind: 'select' as const, values: ['active', 'deleted'] } },
      search: 'Químicos',
    };
    const query = buildCompanyListQuery(original);
    const back = parseCompanyListParams(Object.fromEntries(new URLSearchParams(query)));
    expect(back).toEqual(original);
    expect(companyListHref(original)).toBe(`${MAESTRO_COMPANIES_ROUTE}?${query}`);
    expect(new URLSearchParams(query).get('estado')).toBe('activa,de-baja');
  });

  it('R11: sin busqueda ni filtro la direccion no lleva claves vacias', () => {
    const query = buildCompanyListQuery(parseCompanyListParams({}));
    expect(query).toBe(`page=1&pageSize=${DEFAULT_PAGE_SIZE}`);
  });

  it('R15: reconoce el filtro «solo De baja» y lo sabe quitar volviendo a la primera pagina', () => {
    const params = parseCompanyListParams({ estado: 'de-baja', page: '2', q: 'x' });
    expect(isDeletedOnlyFilter(params)).toBe(true);
    expect(isDeletedOnlyFilter(parseCompanyListParams({ estado: 'activa,de-baja' }))).toBe(false);
    expect(withoutStatusFilter(params)).toMatchObject({ filters: {}, page: 1, search: 'x' });
    expect(withoutSearch(params)).toMatchObject({ search: '', page: 1 });
  });

  it('R10: una busqueda o un filtro nuevos vuelven a la primera pagina; el orden no', () => {
    const current = parseCompanyListParams({ page: '3' });
    expect(withSearchResetsPage(current, { ...current, search: 'a' }).page).toBe(1);
    expect(
      withSearchResetsPage(current, { ...current, sort: { columnId: 'name', direction: 'asc' } }).page,
    ).toBe(3);
  });
});
