import { describe, expect, it } from 'vitest';

import {
  FINISHED_PRODUCT_TABS,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  TAB_PARAM,
  finishedProductPageHref,
  finishedProductTabHref,
  parseFinishedProductParams,
} from '@/app/(private)/inventario/producto-terminado/[id]/components';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/shared/pagination';
import { finishedProductDetailRoute } from '@/lib/shared/routes';
import { FINISHED_PRODUCT_ID } from '../../fixtures/finished-product-detail';

describe('parametros de la ficha de producto terminado', () => {
  it('R9 — cada uno de los siete tabs se lee tal cual de la direccion', () => {
    for (const tab of FINISHED_PRODUCT_TABS) {
      expect(parseFinishedProductParams({ [TAB_PARAM]: tab }).tab).toBe(tab);
    }
  });

  it('R9 — un tab desconocido o ausente abre General', () => {
    expect(parseFinishedProductParams({ [TAB_PARAM]: 'ventas' }).tab).toBe('general');
    expect(parseFinishedProductParams({ [TAB_PARAM]: 'LOTES' }).tab).toBe('general');
    expect(parseFinishedProductParams({}).tab).toBe('general');
    expect(parseFinishedProductParams(undefined).tab).toBe('general');
  });

  it('R9 — page y pageSize que no son enteros validos caen al defecto', () => {
    for (const page of ['0', '-1', '1.5', 'abc', '1e2', ' 2 ', '']) {
      expect(parseFinishedProductParams({ [PAGE_PARAM]: page }).page, page).toBe(1);
    }
    for (const pageSize of ['0', '7', '26', '10.0', 'diez']) {
      expect(parseFinishedProductParams({ [PAGE_SIZE_PARAM]: pageSize }).pageSize, pageSize).toBe(
        DEFAULT_PAGE_SIZE,
      );
    }
  });

  it('R9 — page y pageSize validos se conservan; un parametro repetido toma el primero', () => {
    expect(
      parseFinishedProductParams({
        [TAB_PARAM]: ['lotes', 'costo'],
        [PAGE_PARAM]: '3',
        [PAGE_SIZE_PARAM]: String(MAX_PAGE_SIZE),
      }),
    ).toEqual({ tab: 'lotes', page: 3, pageSize: MAX_PAGE_SIZE });
  });

  it('R9 — el enlace de tab lleva el tab y no lleva pagina', () => {
    const href = finishedProductTabHref(FINISHED_PRODUCT_ID, 'entregas');
    const url = new URL(href, 'http://local');

    expect(url.pathname).toBe(finishedProductDetailRoute(FINISHED_PRODUCT_ID));
    expect(url.searchParams.get(TAB_PARAM)).toBe('entregas');
    expect(url.searchParams.has(PAGE_PARAM)).toBe(false);
    expect(url.searchParams.has(PAGE_SIZE_PARAM)).toBe(false);
  });

  it('R9 — el enlace de pagina se vuelve a leer igual: recargar abre el mismo tab y pagina', () => {
    const href = finishedProductPageHref(FINISHED_PRODUCT_ID, 'salidas', {
      page: 2,
      pageSize: MAX_PAGE_SIZE,
    });
    const url = new URL(href, 'http://local');

    expect(parseFinishedProductParams(Object.fromEntries(url.searchParams))).toEqual({
      tab: 'salidas',
      page: 2,
      pageSize: MAX_PAGE_SIZE,
    });
  });
});
