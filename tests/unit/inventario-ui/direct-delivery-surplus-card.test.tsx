// La tarjeta «Excedente» del sheet de entrega sin pedido: el desglose, los pedidos que esperan y el
// contador con su marca.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DIRECT_DELIVERY_COUNTER_TAG_TESTID,
  DIRECT_DELIVERY_COUNTER_TESTID,
  DIRECT_DELIVERY_SURPLUS_TESTID,
  DIRECT_DELIVERY_WAITING_ORDER_TESTID,
  DIRECT_DELIVERY_WAITING_TESTID,
  DirectDeliverySurplusCard,
} from '@/app/(private)/inventario/components';

import { DIRECT_FIRST_ORDER_ID, DIRECT_SECOND_ORDER_ID, directDeliveryView } from '../../fixtures/direct-delivery';

function montar(writtenPackages: number) {
  const view = directDeliveryView();
  render(
    <DirectDeliverySurplusCard
      stockPackages={view.stockPackages}
      waitingPackages={view.waitingPackages}
      surplusPackages={view.surplusPackages}
      waiting={view.waiting}
      writtenPackages={writtenPackages}
    />,
  );
}

function campo(nombre: string): string {
  const dd = screen.getByTestId(DIRECT_DELIVERY_SURPLUS_TESTID).querySelector(`dd[data-field="${nombre}"]`);
  return dd?.textContent ?? '';
}

afterEach(() => cleanup());

describe('desglose del excedente', () => {
  it('R10: muestra los envases en stock, los que esperan en negativo y «Se puede entregar» igual al excedente', () => {
    montar(0);

    const tarjeta = screen.getByTestId(DIRECT_DELIVERY_SURPLUS_TESTID);
    expect(within(tarjeta).getByRole('heading', { name: 'Excedente' })).toBeInTheDocument();
    expect(within(tarjeta).getByText('En stock')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Esperan pedidos terminados')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Se puede entregar')).toBeInTheDocument();
    expect(campo('stock')).toBe('20 envases');
    expect(campo('waiting')).toBe('−8 envases');
    expect(campo('surplus')).toBe('12 envases');
  });

  it('R10: el desplegable «Ver los pedidos que esperan» lista cada pedido con su numero y lo que le falta', () => {
    montar(0);

    const desplegable = screen.getByTestId(DIRECT_DELIVERY_WAITING_TESTID);
    expect(desplegable.tagName).toBe('DETAILS');
    expect(within(desplegable).getByText('Ver los pedidos que esperan').tagName).toBe('SUMMARY');
    const pedidos = within(desplegable).getAllByTestId(DIRECT_DELIVERY_WAITING_ORDER_TESTID);
    expect(pedidos.map((el) => el.getAttribute('data-order-id'))).toEqual([DIRECT_FIRST_ORDER_ID, DIRECT_SECOND_ORDER_ID]);
    expect(pedidos.map((el) => el.textContent)).toEqual([
      'Pedido 2026-0000031 · faltan 5 envases',
      'Pedido 2026-0000034 · faltan 3 envases',
    ]);
  });
});

describe('contador «Entregas N de M»', () => {
  it.each([
    [0, 'Sin envases', 'muted'],
    [7, 'Quedan 5 libres', 'success'],
    [12, 'Quedan 0 libres', 'success'],
    [15, 'Sobran 3', 'danger'],
  ])('R11: con %i escritos y excedente 12 marca «%s» en tono %s', (escritos, marca, tono) => {
    montar(escritos);

    const contador = screen.getByTestId(DIRECT_DELIVERY_COUNTER_TESTID);
    expect(contador).toHaveTextContent(`Entregas ${escritos} de 12`);
    const etiqueta = within(contador).getByTestId(DIRECT_DELIVERY_COUNTER_TAG_TESTID);
    expect(etiqueta).toHaveTextContent(marca);
    expect(etiqueta).toHaveAttribute('data-tone', tono);
  });
});
