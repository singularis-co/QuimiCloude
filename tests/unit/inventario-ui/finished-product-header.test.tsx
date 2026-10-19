// La cabecera de la ficha de producto terminado: el hueco `actions` que usa «Entregar».

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FinishedProductHeader } from '@/app/(private)/inventario/producto-terminado/[id]/components';

const PRODUCT = { name: 'Desengrasante industrial · Botella 1 L', imagePath: null };

function montar(actions?: React.ReactNode) {
  const { container } = render(
    <FinishedProductHeader product={PRODUCT} inventoryHref="/inventario" finishedListHref="/inventario?type=x" actions={actions} />,
  );
  return container;
}

afterEach(() => cleanup());

describe('FinishedProductHeader', () => {
  it('R5: con `actions`, la cabecera las pinta en el hueco de acciones de PageHeader', () => {
    const container = montar(
      <button type="button" data-testid="accion">
        Entregar
      </button>,
    );

    const hueco = container.querySelector('[data-slot="page-header-actions"]');
    expect(hueco).not.toBeNull();
    expect(hueco).toContainElement(screen.getByTestId('accion'));
    expect(screen.getByTestId('finished-product-name')).toHaveTextContent(PRODUCT.name);
  });

  it('R5: sin `actions`, la cabecera no pinta el hueco ni ningun «Entregar»', () => {
    const container = montar();

    expect(container.querySelector('[data-slot="page-header-actions"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entregar' })).toBeNull();
    expect(screen.getByTestId('finished-product-name')).toHaveTextContent(PRODUCT.name);
  });
});
