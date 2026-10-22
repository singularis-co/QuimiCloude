// El boton «Entregar» de la cabecera de la ficha: abre el sheet de entrega sin pedido de su
// producto, que solo se monta mientras esta abierto.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DIRECT_DELIVERY_OPEN_TESTID,
  DIRECT_DELIVERY_SHEET_TESTID,
  DirectDeliveryButton,
} from '@/app/(private)/inventario/components';
import type { DirectDeliveryResult } from '@/lib/modules/pedidos/adapters/driving/order-actions';

import { DIRECT_PRODUCT_ID, directDeliveryView } from '../../fixtures/direct-delivery';
import { setupUser } from '../../helpers/user-event';

const { getDirectMock, routerMock } = vi.hoisted(() => ({
  getDirectMock: vi.fn<(productId: string) => Promise<DirectDeliveryResult>>(),
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  getDirectDeliveryAction: getDirectMock,
  deliverDirectAction: vi.fn(),
  searchOrderCustomersAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  getDirectMock.mockResolvedValue({ status: 'success', data: directDeliveryView() });
});

afterEach(() => cleanup());

describe('DirectDeliveryButton', () => {
  it('R7: pulsar «Entregar» abre el sheet «Entregar sin pedido» de ese producto', async () => {
    const user = setupUser();
    render(<DirectDeliveryButton productId={DIRECT_PRODUCT_ID} />);

    const boton = screen.getByTestId(DIRECT_DELIVERY_OPEN_TESTID);
    expect(boton).toHaveAccessibleName('Entregar');
    expect(screen.queryByTestId(DIRECT_DELIVERY_SHEET_TESTID)).toBeNull();
    expect(getDirectMock).not.toHaveBeenCalled();

    await user.click(boton);

    expect(await screen.findByTestId(DIRECT_DELIVERY_SHEET_TESTID)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entregar sin pedido' })).toBeInTheDocument();
    expect(getDirectMock).toHaveBeenCalledWith(DIRECT_PRODUCT_ID);
  });

  it('R7: al cerrar el sheet se desmonta y se puede volver a abrir', async () => {
    const user = setupUser();
    render(<DirectDeliveryButton productId={DIRECT_PRODUCT_ID} />);

    await user.click(screen.getByTestId(DIRECT_DELIVERY_OPEN_TESTID));
    await screen.findByTestId(DIRECT_DELIVERY_SHEET_TESTID);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId(DIRECT_DELIVERY_SHEET_TESTID)).toBeNull());

    await user.click(screen.getByTestId(DIRECT_DELIVERY_OPEN_TESTID));
    expect(await screen.findByTestId(DIRECT_DELIVERY_SHEET_TESTID)).toBeInTheDocument();
    expect(getDirectMock).toHaveBeenCalledTimes(2);
  });
});
