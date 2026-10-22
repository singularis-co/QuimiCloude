// El resumen «Por entregar» del sheet de entrega, montado solo.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ORDER_DELIVERY_LINE_COMPLETE_TESTID,
  ORDER_DELIVERY_LINE_EXCEEDS_TESTID,
  ORDER_DELIVERY_LINE_MISSING_TESTID,
  ORDER_DELIVERY_SUMMARY_LINE_TESTID,
  ORDER_DELIVERY_SUMMARY_TESTID,
  OrderDeliverySummary,
  type OrderDeliverySummaryLabels,
  type OrderDeliverySummaryLine,
} from '@/app/(private)/pedidos/components';

const LABELS: OrderDeliverySummaryLabels = {
  title: 'Por entregar',
  written: 'Entregas',
  of: 'de',
  complete: 'Completa',
  missing: (packages) => `Faltan ${packages}`,
  exceeds: (packages) => `Sobran ${packages}`,
  footnote: 'Suma de todos los clientes. El pedido es el tope por presentación.',
};

function line(id: string, name: string, writtenPackages: number, remainingPackages: number): OrderDeliverySummaryLine {
  return { presentationLineId: id, presentationName: name, writtenPackages, remainingPackages };
}

function fila(id: string): HTMLElement {
  const encontrada = screen
    .getAllByTestId(ORDER_DELIVERY_SUMMARY_LINE_TESTID)
    .find((row) => row.getAttribute('data-presentation-line-id') === id);
  if (encontrada === undefined) throw new Error(`no hay fila ${id}`);
  return encontrada;
}

afterEach(() => cleanup());

describe('resumen «Por entregar»', () => {
  it('R11: una fila por presentacion con lo escrito, lo que falta y su marca', () => {
    render(
      <OrderDeliverySummary
        labels={LABELS}
        lines={[
          line('igual', 'Botella 1 L', 7, 7),
          line('menos', 'Galon 4 L', 2, 5),
          line('mas', 'Bidon 20 L', 6, 4),
        ]}
      />,
    );

    const resumen = screen.getByTestId(ORDER_DELIVERY_SUMMARY_TESTID);
    expect(within(resumen).getByRole('heading', { name: 'Por entregar' })).toBeInTheDocument();
    expect(screen.getAllByTestId(ORDER_DELIVERY_SUMMARY_LINE_TESTID)).toHaveLength(3);

    expect(fila('igual')).toHaveTextContent('Botella 1 LEntregas 7 de 7Completa');
    expect(within(fila('igual')).getByTestId(ORDER_DELIVERY_LINE_COMPLETE_TESTID)).toHaveAttribute('data-tone', 'success');

    expect(fila('menos')).toHaveTextContent('Galon 4 LEntregas 2 de 5Faltan 3');
    expect(within(fila('menos')).getByTestId(ORDER_DELIVERY_LINE_MISSING_TESTID)).toHaveAttribute('data-tone', 'waiting');

    expect(fila('mas')).toHaveTextContent('Bidon 20 LEntregas 6 de 4Sobran 2');
    expect(within(fila('mas')).getByTestId(ORDER_DELIVERY_LINE_EXCEEDS_TESTID)).toHaveAttribute('data-tone', 'danger');
  });

  it('R11: una presentacion ya entregada del todo, sin nada escrito, sale «Completa»', () => {
    render(<OrderDeliverySummary labels={LABELS} lines={[line('hecha', 'Galon 4 L', 0, 0)]} />);
    expect(within(fila('hecha')).getByTestId(ORDER_DELIVERY_LINE_COMPLETE_TESTID)).toHaveTextContent('Completa');
  });

  it('R12: la marca de exceso solo sale en la presentacion que se pasa', () => {
    render(
      <OrderDeliverySummary
        labels={LABELS}
        lines={[line('ok', 'Botella 1 L', 3, 7), line('pasa', 'Galon 4 L', 6, 5)]}
      />,
    );

    expect(screen.getAllByTestId(ORDER_DELIVERY_LINE_EXCEEDS_TESTID)).toHaveLength(1);
    expect(within(fila('pasa')).getByTestId(ORDER_DELIVERY_LINE_EXCEEDS_TESTID)).toHaveTextContent('Sobran 1');
    expect(within(fila('ok')).queryByTestId(ORDER_DELIVERY_LINE_EXCEEDS_TESTID)).toBeNull();
  });

  it('muestra la nota de que la suma es de todos los clientes', () => {
    render(<OrderDeliverySummary labels={LABELS} lines={[]} />);
    expect(screen.getByText(LABELS.footnote)).toBeInTheDocument();
  });
});
