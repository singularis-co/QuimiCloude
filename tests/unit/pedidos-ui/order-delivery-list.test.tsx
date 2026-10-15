// La lista es presentacional: recibe la vista ya ordenada por el servidor y no llama a nada. Los
// controles se localizan por `data-testid`; el copy solo se afirma donde el requisito lo nombra
// («Anulada»).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrderDeliveryList } from '@/app/(private)/pedidos/components';
import { ORDER_STATUS_VALUES, type OrderStatus } from '@/lib/modules/pedidos';
import {
  FIRST_BATCH_ID,
  NEWER_DELIVERY_ID,
  OLDER_DELIVERY_ID,
  OPEN_LINE_ID,
  SECOND_BATCH_ID,
  THIRD_BATCH_ID,
  VOIDED_LINE_ID,
  VOID_REASON,
  deliveryHistoryView,
} from '../../fixtures/order-delivery-void';

afterEach(() => {
  cleanup();
});

const VISTA = deliveryHistoryView();

function pintar(
  props: Partial<Parameters<typeof OrderDeliveryList>[0]> = {},
) {
  return render(
    <OrderDeliveryList
      deliveries={VISTA.deliveries}
      canVoid
      orderStatus={VISTA.orderStatus}
      onVoid={vi.fn()}
      {...props}
    />,
  );
}

function entrega(id: string): HTMLElement {
  const fila = document.querySelector<HTMLElement>(
    `[data-testid="order-delivery-entry"][data-delivery-id="${id}"]`,
  );
  if (fila === null) throw new Error(`no se pinto la entrega ${id}`);
  return fila;
}

function presentacion(fila: HTMLElement, lineId: string): HTMLElement {
  const nodo = fila.querySelector<HTMLElement>(
    `[data-testid="order-delivery-entry-presentation"][data-presentation-line-id="${lineId}"]`,
  );
  if (nodo === null) throw new Error(`no se pinto la presentacion ${lineId}`);
  return nodo;
}

describe('OrderDeliveryList', () => {
  it('R7: pinta cada entrega en el orden recibido, de la mas reciente a la mas antigua, con fecha, cliente y autor', () => {
    pintar();

    const filas = screen.getAllByTestId('order-delivery-entry');
    expect(filas.map((fila) => fila.getAttribute('data-delivery-id'))).toEqual([
      NEWER_DELIVERY_ID,
      OLDER_DELIVERY_ID,
    ]);

    const reciente = entrega(NEWER_DELIVERY_ID);
    expect(within(reciente).getByTestId('order-delivery-entry-date')).toHaveTextContent('2026-10-08 15:30');
    expect(within(reciente).getByTestId('order-delivery-entry-customer')).toHaveTextContent('Ana Perez');
    expect(within(reciente).getByTestId('order-delivery-entry-author')).toHaveTextContent('Laura Gomez');

    const antigua = entrega(OLDER_DELIVERY_ID);
    expect(within(antigua).getByTestId('order-delivery-entry-date')).toHaveTextContent('2026-10-07 11:00');
    expect(within(antigua).getByTestId('order-delivery-entry-author')).toHaveTextContent('Carlos Ruiz');
  });

  it('R7: por presentacion pinta nombre y envases, y por lote su codigo y sus envases', () => {
    pintar();

    const reciente = entrega(NEWER_DELIVERY_ID);
    const presentaciones = within(reciente).getAllByTestId('order-delivery-entry-presentation');
    expect(presentaciones.map((nodo) => nodo.getAttribute('data-presentation-line-id'))).toEqual([
      OPEN_LINE_ID,
      VOIDED_LINE_ID,
    ]);

    const abierta = presentacion(reciente, OPEN_LINE_ID);
    expect(within(abierta).getByTestId('order-delivery-entry-presentation-name')).toHaveTextContent('Botella 1 L');
    expect(within(abierta).getByTestId('order-delivery-entry-presentation-packages')).toHaveTextContent('6');
    const lotes = within(abierta).getAllByTestId('order-delivery-entry-batch');
    expect(lotes.map((lote) => lote.getAttribute('data-batch-id'))).toEqual([FIRST_BATCH_ID, SECOND_BATCH_ID]);
    expect(within(lotes[0]!).getByTestId('order-delivery-entry-batch-lot')).toHaveTextContent('L-2026-0101');
    expect(within(lotes[0]!).getByTestId('order-delivery-entry-batch-packages')).toHaveTextContent('4');
    expect(within(lotes[1]!).getByTestId('order-delivery-entry-batch-lot')).toHaveTextContent('L-2026-0102');
    expect(within(lotes[1]!).getByTestId('order-delivery-entry-batch-packages')).toHaveTextContent('2');
  });

  it('R8: sin ninguna entrega muestra el aviso de pedido sin entregas y ninguna fila', () => {
    pintar({ deliveries: [] });

    expect(screen.getByTestId('order-deliveries-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('order-delivery-entry')).toBeNull();
    expect(screen.queryByTestId('order-delivery-void')).toBeNull();
  });

  it('R8: con entregas no muestra el aviso de vacio', () => {
    pintar();

    expect(screen.queryByTestId('order-deliveries-empty')).toBeNull();
  });

  it('R9: la presentacion anulada queda marcada como «Anulada», con motivo, autor y fecha, junto a sus envases y lotes originales', () => {
    pintar();

    const anulada = presentacion(entrega(NEWER_DELIVERY_ID), VOIDED_LINE_ID);
    const marca = within(anulada).getByTestId('order-delivery-entry-voided');
    expect(marca).toHaveTextContent('Anulada');
    expect(within(marca).getByTestId('order-delivery-entry-void-reason')).toHaveTextContent(VOID_REASON);
    expect(within(marca).getByTestId('order-delivery-entry-void-author')).toHaveTextContent('Laura Gomez');
    expect(within(marca).getByTestId('order-delivery-entry-void-date')).toHaveTextContent('2026-10-09 09:00');

    expect(within(anulada).getByTestId('order-delivery-entry-presentation-name')).toHaveTextContent('Galon 4 L');
    expect(within(anulada).getByTestId('order-delivery-entry-presentation-packages')).toHaveTextContent('3');
    const [lote] = within(anulada).getAllByTestId('order-delivery-entry-batch');
    expect(lote).toHaveAttribute('data-batch-id', THIRD_BATCH_ID);
    expect(within(lote!).getByTestId('order-delivery-entry-batch-lot')).toHaveTextContent('L-2026-0103');
  });

  it('R9: una presentacion sin anular no lleva la marca', () => {
    pintar();

    expect(
      within(presentacion(entrega(NEWER_DELIVERY_ID), OPEN_LINE_ID)).queryByTestId('order-delivery-entry-voided'),
    ).toBeNull();
    expect(within(entrega(OLDER_DELIVERY_ID)).queryByTestId('order-delivery-entry-voided')).toBeNull();
  });

  it.each(['TERMINADO', 'ENTREGADO'] as const)(
    'R10: con canVoid y el pedido %s, cada entrega con algo sin anular ofrece «Anular» y emite la entrega',
    (status) => {
      const onVoid = vi.fn();
      pintar({ orderStatus: status, onVoid });

      expect(screen.getAllByTestId('order-delivery-void')).toHaveLength(2);
      fireEvent.click(within(entrega(OLDER_DELIVERY_ID)).getByTestId('order-delivery-void'));
      expect(onVoid).toHaveBeenCalledExactlyOnceWith(VISTA.deliveries[1]);
    },
  );

  it('R10: sin canVoid la accion no existe en el DOM', () => {
    pintar({ canVoid: false });

    expect(screen.queryByTestId('order-delivery-void')).toBeNull();
    expect(document.querySelector('[data-testid="order-delivery-void"]')).toBeNull();
  });

  it('R10: una entrega con todas sus presentaciones anuladas no ofrece «Anular»', () => {
    const [reciente, antigua] = VISTA.deliveries;
    // 2026-10-15: las presentaciones van por cliente.
    const todaAnulada = {
      ...antigua!,
      customers: antigua!.customers.map((customer) => ({
        ...customer,
        presentations: customer.presentations.map((item) => ({
          ...item,
          void: { reason: VOID_REASON, authorName: 'Laura Gomez', createdAt: '2026-10-09T10:00:00.000Z' },
        })),
      })),
    };
    pintar({ deliveries: [reciente!, todaAnulada] });

    expect(within(entrega(OLDER_DELIVERY_ID)).queryByTestId('order-delivery-void')).toBeNull();
    expect(within(entrega(NEWER_DELIVERY_ID)).getByTestId('order-delivery-void')).toBeInTheDocument();
  });

  it.each(
    ORDER_STATUS_VALUES.filter((status): status is OrderStatus => status !== 'TERMINADO' && status !== 'ENTREGADO'),
  )('R10: con el pedido %s no ofrece «Anular» aunque haya permiso', (status) => {
    pintar({ orderStatus: status });

    expect(screen.getAllByTestId('order-delivery-entry')).toHaveLength(2);
    expect(screen.queryByTestId('order-delivery-void')).toBeNull();
  });

  it('el componente no importa ninguna action ni la composicion', () => {
    const fuente = readFileSync(
      resolve(process.cwd(), 'app/(private)/pedidos/components/order-delivery-list.tsx'),
      'utf8',
    );

    expect(fuente).not.toMatch(/adapters\/driving/);
    expect(fuente).not.toMatch(/lib\/composition/);
    expect(fuente).not.toMatch(/Action\b/);
  });
});
