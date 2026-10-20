// El reparto de un pedido producido, con cada presentación enlazada a su producto terminado.
//
// El barrel de la ruta arrastra la sección, que importa las actions de `pedidos`; se sustituyen
// por dobles que fallan si se les llama: este componente solo pinta lo que recibe.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_PRODUCED_LIST_TESTID,
  ORDER_PRODUCED_MORE_TESTID,
  ORDER_PRODUCED_PRESENTATIONS_TESTID,
  ORDER_PRODUCED_PRODUCT_LINK_TESTID,
  OrderProducedPresentations,
} from '@/app/(private)/pedidos/components';
import type { OrderPresentationLineView } from '@/lib/modules/pedidos';
import { finishedProductDetailRoute } from '@/lib/shared/routes';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el reparto producido`);
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

const PRESENTACION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRESENTACION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRESENTACION_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PRODUCTO_A = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';
const PRODUCTO_C = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0';

function linea(
  presentationId: string,
  presentationName: string,
  packages: number,
): OrderPresentationLineView {
  return { presentationId, presentationName, packages, packagingProductId: null, packagingName: null, presentationContent: null, presentationUnitLabel: null };
}

const LINEAS = [
  linea(PRESENTACION_A, 'Botella 200 ml', 5),
  linea(PRESENTACION_B, 'Bidón 20L', 1),
  linea(PRESENTACION_C, 'Garrafa 5L', 3),
] as const;

afterEach(() => {
  cleanup();
});

describe('el reparto producido de un pedido', () => {
  it('R27: la primera presentación con producto es un enlace a la ficha de ese producto', () => {
    render(
      <OrderProducedPresentations
        lines={LINEAS}
        productByPresentation={{ [PRESENTACION_A]: PRODUCTO_A }}
      />,
    );

    const enlace = screen.getByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID);
    expect(enlace).toHaveAttribute('href', finishedProductDetailRoute(PRODUCTO_A));
    expect(enlace).toHaveAttribute('data-presentation-id', PRESENTACION_A);
    expect(enlace).toHaveTextContent('5 × Botella 200 ml');
    expect(screen.getByTestId(ORDER_PRODUCED_MORE_TESTID)).toHaveTextContent('+2');
  });

  it('R27: dentro del «+N» hay un enlace por cada presentación con producto, también las ocultas', async () => {
    const user = setupUser();
    render(
      <OrderProducedPresentations
        lines={LINEAS}
        productByPresentation={{ [PRESENTACION_A]: PRODUCTO_A, [PRESENTACION_C]: PRODUCTO_C }}
      />,
    );

    await user.click(screen.getByTestId(ORDER_PRODUCED_MORE_TESTID));
    const lista = await screen.findByTestId(ORDER_PRODUCED_LIST_TESTID);
    await esperarInteractiva(lista);

    const enlaces = within(lista).getAllByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID);
    expect(enlaces.map((enlace) => enlace.getAttribute('data-presentation-id'))).toEqual([
      PRESENTACION_A,
      PRESENTACION_C,
    ]);
    expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual([
      finishedProductDetailRoute(PRODUCTO_A),
      finishedProductDetailRoute(PRODUCTO_C),
    ]);
    expect(within(lista).getAllByRole('listitem')).toHaveLength(LINEAS.length);
  });

  it('R28: una presentación sin producto se pinta como texto, sin enlace', async () => {
    const user = setupUser();
    render(
      <OrderProducedPresentations
        lines={LINEAS}
        productByPresentation={{ [PRESENTACION_C]: PRODUCTO_C }}
      />,
    );

    const reparto = screen.getByTestId(ORDER_PRODUCED_PRESENTATIONS_TESTID);
    expect(reparto).toHaveTextContent('5 × Botella 200 ml');
    expect(within(reparto).queryByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID)).toBeNull();

    await user.click(screen.getByTestId(ORDER_PRODUCED_MORE_TESTID));
    const lista = await screen.findByTestId(ORDER_PRODUCED_LIST_TESTID);
    await esperarInteractiva(lista);

    const enlaces = within(lista).getAllByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID);
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]).toHaveAttribute('data-presentation-id', PRESENTACION_C);
    expect(within(lista).getByText('1 × Bidón 20L').closest('a')).toBeNull();
    expect(within(lista).getByText('5 × Botella 200 ml').closest('a')).toBeNull();
  });

  it('R28: una sola línea sin producto no pinta enlace ni «+N»', () => {
    render(
      <OrderProducedPresentations lines={[LINEAS[1]]} productByPresentation={{}} />,
    );

    expect(screen.getByTestId(ORDER_PRODUCED_PRESENTATIONS_TESTID)).toHaveTextContent('1 × Bidón 20L');
    expect(screen.queryByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_PRODUCED_MORE_TESTID)).toBeNull();
  });

  it('una línea con envase y volumen conocido pinta el envase y el volumen', () => {
    const conVolumen: OrderPresentationLineView = {
      presentationId: PRESENTACION_A,
      presentationName: '300 ml',
      packages: 9,
      packagingProductId: 'e-1',
      packagingName: 'Embase pequeño 2',
      presentationContent: '300.0000',
      presentationUnitLabel: 'ml',
    };
    render(<OrderProducedPresentations lines={[conVolumen]} productByPresentation={{}} />);

    expect(screen.getByTestId(ORDER_PRODUCED_PRESENTATIONS_TESTID)).toHaveTextContent(
      '9 × Embase pequeño 2 · 300 ml',
    );
  });
});
