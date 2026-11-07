// La barra de avance de un pedido: forma corta para el listado y larga para el detalle.
//
// El barrel de la ruta arrastra la sección, que importa las actions de `pedidos`; se sustituyen
// por dobles que fallan si se les llama: este componente solo pinta lo que recibe.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_PROGRESS_BAR_TESTID,
  ORDER_PROGRESS_TESTID,
  OrderProgress,
} from '@/app/(private)/pedidos/components';

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde la barra de avance`);
  };
  return {
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
    createOrderAction: vi.fn(noDebeInvocarse('createOrderAction')),
    updateOrderAction: vi.fn(noDebeInvocarse('updateOrderAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

afterEach(cleanup);

function barra(): HTMLElement {
  return screen.getByTestId(ORDER_PROGRESS_BAR_TESTID);
}

describe('OrderProgress', () => {
  it('R21: la forma corta pinta «F de T» y la barra con el ancho de lo terminado', () => {
    render(<OrderProgress progress={{ finished: 1, total: 3 }} />);

    const avance = screen.getByTestId(ORDER_PROGRESS_TESTID);
    expect(avance).toHaveTextContent(/^1 de 3$/);
    expect(barra()).toHaveStyle({ width: '33%' });
  });

  it('R18: la forma larga pinta «N de M terminadas» con su rótulo', () => {
    render(<OrderProgress progress={{ finished: 2, total: 2 }} variant="long" label="Avance" />);

    const avance = screen.getByTestId(ORDER_PROGRESS_TESTID);
    expect(avance).toHaveTextContent('Avance');
    expect(avance).toHaveTextContent('2 de 2 terminadas');
    expect(barra()).toHaveStyle({ width: '100%' });
  });

  it('R21: con 0 de 0 pinta «0 de 0» y la barra vacía, sin dividir entre cero', () => {
    render(<OrderProgress progress={{ finished: 0, total: 0 }} />);

    expect(screen.getByTestId(ORDER_PROGRESS_TESTID)).toHaveTextContent(/^0 de 0$/);
    expect(barra()).toHaveStyle({ width: '0%' });
  });

  it.each(['short', 'long'] as const)(
    'R18, R21: en la forma %s el nombre accesible lleva el texto y la barra va aria-hidden',
    (variant) => {
      render(<OrderProgress progress={{ finished: 1, total: 4 }} variant={variant} />);

      expect(screen.getByRole('img', { name: '1 de 4 terminadas' })).toBeInTheDocument();
      expect(barra().closest('[aria-hidden="true"]')).not.toBeNull();
    },
  );

  it('R46: la barra anima el cambio de ancho con los tokens de movimiento', () => {
    const { rerender } = render(<OrderProgress progress={{ finished: 1, total: 4 }} />);
    expect(barra()).toHaveStyle({ width: '25%' });
    expect(barra()).toHaveClass('transition-[width]', 'duration-(--dur-slow)', 'ease-(--ease-standard)');

    rerender(<OrderProgress progress={{ finished: 3, total: 4 }} />);
    expect(barra()).toHaveStyle({ width: '75%' });
  });

  it('R21: los textos llegan por props para la traducción', () => {
    render(
      <OrderProgress
        progress={{ finished: 1, total: 2 }}
        texts={{ short: (f, t) => `${f}/${t}`, long: (f, t) => `${f} of ${t} done` }}
      />,
    );

    expect(screen.getByRole('img', { name: '1 of 2 done' })).toHaveTextContent('1/2');
  });
});
