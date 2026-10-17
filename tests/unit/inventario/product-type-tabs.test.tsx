import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PRODUCT_TYPE_TABS_LABEL,
  PRODUCT_TYPE_TABS_TESTID,
  ProductTypeTabs,
  TYPE_COLUMN_ID,
  productListHref,
} from '@/app/(private)/inventario/components';
import type { DataTableParams } from '@/components/shared/data-table';
import { PRODUCT_TYPES, type ProductType } from '@/lib/modules/inventario';

afterEach(() => {
  cleanup();
});

const ORDEN = ['Todos', 'Producto', 'Máquina', 'Envase', 'Producto terminado'] as const;
const VALOR: Readonly<Record<(typeof ORDEN)[number], ProductType | 'all'>> = {
  Todos: 'all',
  Producto: PRODUCT_TYPES.PRODUCT,
  Máquina: PRODUCT_TYPES.MACHINE,
  Envase: PRODUCT_TYPES.PACKAGING,
  'Producto terminado': PRODUCT_TYPES.FINISHED_PRODUCT,
};

const CONSULTA: DataTableParams = {
  page: 4,
  pageSize: 25,
  sort: { columnId: 'stock', direction: 'asc' },
  search: 'glicerina',
  filters: { qtyAlert: { kind: 'numberRange', min: null, max: 9 } },
};

function conTipo(type: ProductType): DataTableParams {
  return {
    ...CONSULTA,
    filters: { ...CONSULTA.filters, [TYPE_COLUMN_ID]: { kind: 'select', values: [type] } },
  };
}

/** Lo que producía elegir la pestaña antes de ser un enlace: página 1 y el tipo puesto o quitado. */
function destinoDeAntes(params: DataTableParams, value: ProductType | 'all'): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [TYPE_COLUMN_ID]: _tipo, ...resto } = params.filters;
  return productListHref({
    ...params,
    page: 1,
    filters:
      value === 'all' ? resto : { ...resto, [TYPE_COLUMN_ID]: { kind: 'select', values: [value] } },
  });
}

describe('ProductTypeTabs sobre UrlTabs', () => {
  it('R3 — pinta las cinco pestañas en orden, en una lista «Filtrar por tipo de producto»', () => {
    render(<ProductTypeTabs params={CONSULTA} />);

    const lista = screen.getByRole('tablist', { name: PRODUCT_TYPE_TABS_LABEL });
    expect(PRODUCT_TYPE_TABS_LABEL).toBe('Filtrar por tipo de producto');
    expect(lista).toHaveAttribute('data-testid', PRODUCT_TYPE_TABS_TESTID);
    expect(within(lista).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([...ORDEN]);
  });

  it('R3 — cada pestaña es un enlace a la dirección que daba elegirla, con búsqueda y orden intactos', () => {
    render(<ProductTypeTabs params={conTipo(PRODUCT_TYPES.MACHINE)} />);

    for (const nombre of ORDEN) {
      const tab = screen.getByRole('tab', { name: nombre });
      expect(tab.tagName).toBe('A');
      const href = tab.getAttribute('href') ?? '';
      expect(href).toBe(destinoDeAntes(conTipo(PRODUCT_TYPES.MACHINE), VALOR[nombre]));

      const query = new URLSearchParams(href.split('?')[1]);
      expect(query.get('page')).toBe('1');
      expect(query.get('q')).toBe('glicerina');
      expect(query.get('sort')).toBe('stock:asc');
      expect(query.get('alertMax')).toBe('9');
      expect(query.get('type')).toBe(VALOR[nombre] === 'all' ? null : VALOR[nombre]);
    }
  });

  it('R3 — sin filtro de tipo la vigente es «Todos»; con filtro, la de su tipo', () => {
    render(<ProductTypeTabs params={CONSULTA} />);
    for (const nombre of ORDEN) {
      expect(screen.getByRole('tab', { name: nombre })).toHaveAttribute(
        'aria-selected',
        nombre === 'Todos' ? 'true' : 'false',
      );
    }
    cleanup();

    render(<ProductTypeTabs params={conTipo(PRODUCT_TYPES.FINISHED_PRODUCT)} />);
    for (const nombre of ORDEN) {
      expect(screen.getByRole('tab', { name: nombre })).toHaveAttribute(
        'aria-selected',
        nombre === 'Producto terminado' ? 'true' : 'false',
      );
    }
  });

  it('R4 — no pinta «Mostrando todos los tipos» ni «Filtrando por» bajo las pestañas', () => {
    const { container } = render(<ProductTypeTabs params={CONSULTA} />);
    expect(container).not.toHaveTextContent('Mostrando todos los tipos');
    expect(screen.queryByRole('tabpanel')).toBeNull();
    cleanup();

    const filtrada = render(<ProductTypeTabs params={conTipo(PRODUCT_TYPES.PACKAGING)} />);
    expect(filtrada.container).not.toHaveTextContent('Filtrando por');
    expect(screen.queryByRole('tabpanel')).toBeNull();
  });

  it('R5 — la lista se desplaza en horizontal sin saltar de línea', () => {
    render(<ProductTypeTabs params={CONSULTA} />);

    const lista = screen.getByRole('tablist', { name: PRODUCT_TYPE_TABS_LABEL });
    expect(lista).toHaveClass('overflow-x-auto', 'flex-nowrap', 'max-w-full');
  });
});
