import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FINISHED_PRODUCT_TABS,
  FINISHED_PRODUCT_TABS_LABEL,
  FINISHED_PRODUCT_TAB_LABELS,
  FinishedProductTabs,
  PAGE_PARAM,
  TAB_PARAM,
  finishedProductTabTestId,
} from '@/app/(private)/inventario/producto-terminado/[id]/components';
import { finishedProductDetailRoute } from '@/lib/shared/routes';
import { FINISHED_PRODUCT_ID } from '../../fixtures/finished-product-detail';

afterEach(cleanup);

describe('tabs de la ficha de producto terminado', () => {
  it('R8, R26 — ocho tabs en este orden: General, Stock, Lotes, Entradas, Salidas, Entregas, Costo de produccion y Reparto', () => {
    render(<FinishedProductTabs productId={FINISHED_PRODUCT_ID} current="general" />);

    const lista = screen.getByRole('tablist', { name: FINISHED_PRODUCT_TABS_LABEL });
    const pestanas = within(lista).getAllByRole('tab');

    expect(pestanas.map((pestana) => pestana.textContent)).toEqual([
      'General',
      'Stock',
      'Lotes',
      'Entradas',
      'Salidas',
      'Entregas',
      'Costo de producción',
      'Reparto',
    ]);
    expect(pestanas.map((pestana) => pestana.getAttribute('data-testid'))).toEqual(
      FINISHED_PRODUCT_TABS.map(finishedProductTabTestId),
    );
    expect(FINISHED_PRODUCT_TABS.map((tab) => FINISHED_PRODUCT_TAB_LABELS[tab])).toEqual(
      pestanas.map((pestana) => pestana.textContent),
    );
  });

  it('R9 — el tab de la direccion queda seleccionado', () => {
    render(<FinishedProductTabs productId={FINISHED_PRODUCT_ID} current="entregas" />);

    expect(screen.getByTestId(finishedProductTabTestId('entregas'))).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId(finishedProductTabTestId('general'))).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('R9 — cambiar de tab cambia tab en la direccion y quita page', () => {
    render(<FinishedProductTabs productId={FINISHED_PRODUCT_ID} current="lotes" />);

    for (const tab of FINISHED_PRODUCT_TABS) {
      const enlace = screen.getByTestId(finishedProductTabTestId(tab));
      expect(enlace.tagName).toBe('A');

      const url = new URL(enlace.getAttribute('href') as string, 'http://local');
      expect(url.pathname).toBe(finishedProductDetailRoute(FINISHED_PRODUCT_ID));
      expect(url.searchParams.get(TAB_PARAM)).toBe(tab);
      expect(url.searchParams.has(PAGE_PARAM)).toBe(false);
    }
  });
});
