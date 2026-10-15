// La lista es presentacional: recibe la vista ya ordenada por el servidor y no llama a nada. Los
// controles se localizan por `data-testid`; el copy solo se afirma donde el requisito lo nombra
// («Anulada»).
//
// 2026-10-15: cada entrega agrupa sus presentaciones por cliente. Los casos de QC-224 R7, R9 y R10
// pasan a R33, R34 y R35 de la entrega a varios clientes; R8 (vacio) sigue igual.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrderDeliveryList, type OrderDeliveryHistoryEntry } from '@/app/(private)/pedidos/components';
import { ORDER_STATUS_VALUES, type OrderStatus } from '@/lib/modules/pedidos';
import {
  FIRST_BATCH_ID,
  FIRST_CUSTOMER_ID,
  NEWER_DELIVERY_ID,
  OLDER_DELIVERY_ID,
  OPEN_LINE_ID,
  SECOND_BATCH_ID,
  SECOND_CUSTOMER_ID,
  THIRD_BATCH_ID,
  VOIDED_LINE_ID,
  VOID_REASON,
  deliveryHistoryView,
} from '../../fixtures/order-delivery-void';

afterEach(() => {
  cleanup();
});

const VISTA = deliveryHistoryView();
const ANULACION = { reason: VOID_REASON, authorName: 'Laura Gomez', createdAt: '2026-10-09T10:00:00.000Z' };

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

function cliente(fila: HTMLElement, customerId: string): HTMLElement {
  const nodo = fila.querySelector<HTMLElement>(
    `[data-testid="order-delivery-entry-customer"][data-customer-id="${customerId}"]`,
  );
  if (nodo === null) throw new Error(`no se pinto el cliente ${customerId}`);
  return nodo;
}

function presentacion(bloque: HTMLElement, lineId: string): HTMLElement {
  const nodo = bloque.querySelector<HTMLElement>(
    `[data-testid="order-delivery-entry-presentation"][data-presentation-line-id="${lineId}"]`,
  );
  if (nodo === null) throw new Error(`no se pinto la presentacion ${lineId}`);
  return nodo;
}

/** La entrega dada con todos los pares anulados, o solo los del cliente indicado. */
function anular(delivery: OrderDeliveryHistoryEntry, soloCliente?: string): OrderDeliveryHistoryEntry {
  return {
    ...delivery,
    customers: delivery.customers.map((customer) =>
      soloCliente !== undefined && customer.customerId !== soloCliente
        ? customer
        : {
            ...customer,
            presentations: customer.presentations.map((item) => ({ ...item, void: ANULACION })),
          },
    ),
  };
}

describe('OrderDeliveryList', () => {
  it('R33: pinta cada entrega en el orden recibido como tarjeta con fecha, numero de clientes, total de envases y autor', () => {
    pintar();

    const filas = screen.getAllByTestId('order-delivery-entry');
    expect(filas.map((fila) => fila.getAttribute('data-delivery-id'))).toEqual([
      NEWER_DELIVERY_ID,
      OLDER_DELIVERY_ID,
    ]);

    const reciente = entrega(NEWER_DELIVERY_ID);
    expect(within(reciente).getByTestId('order-delivery-entry-date')).toHaveTextContent('2026-10-08 15:30');
    expect(within(reciente).getByTestId('order-delivery-entry-customers')).toHaveTextContent('2');
    expect(within(reciente).getByTestId('order-delivery-entry-packages')).toHaveTextContent('11');
    expect(within(reciente).getByTestId('order-delivery-entry-author')).toHaveTextContent('Laura Gomez');

    const antigua = entrega(OLDER_DELIVERY_ID);
    expect(within(antigua).getByTestId('order-delivery-entry-date')).toHaveTextContent('2026-10-07 11:00');
    expect(within(antigua).getByTestId('order-delivery-entry-customers')).toHaveTextContent('1');
    expect(within(antigua).getByTestId('order-delivery-entry-packages')).toHaveTextContent('4');
    expect(within(antigua).getByTestId('order-delivery-entry-author')).toHaveTextContent('Carlos Ruiz');
  });

  it('R33: dentro de la tarjeta pinta un subbloque por cliente, en el orden recibido, nombrado con su cliente', () => {
    pintar();

    const reciente = entrega(NEWER_DELIVERY_ID);
    const bloques = within(reciente).getAllByTestId('order-delivery-entry-customer');
    expect(bloques.map((bloque) => bloque.getAttribute('data-customer-id'))).toEqual([
      FIRST_CUSTOMER_ID,
      SECOND_CUSTOMER_ID,
    ]);
    expect(within(reciente).getByRole('region', { name: 'Ana Perez' })).toBe(bloques[0]);
    expect(within(reciente).getByRole('region', { name: 'Bruno Diaz' })).toBe(bloques[1]);
    expect(within(bloques[0]!).getByTestId('order-delivery-entry-customer-name')).toHaveTextContent('Ana Perez');
  });

  it('R33: por presentacion de cada cliente pinta nombre y envases, y por lote su codigo y sus envases', () => {
    pintar();

    const reciente = entrega(NEWER_DELIVERY_ID);
    const ana = cliente(reciente, FIRST_CUSTOMER_ID);
    expect(
      within(ana).getAllByTestId('order-delivery-entry-presentation').map((nodo) => nodo.getAttribute('data-presentation-line-id')),
    ).toEqual([OPEN_LINE_ID, VOIDED_LINE_ID]);

    const abierta = presentacion(ana, OPEN_LINE_ID);
    expect(within(abierta).getByTestId('order-delivery-entry-presentation-name')).toHaveTextContent('Botella 1 L');
    expect(within(abierta).getByTestId('order-delivery-entry-presentation-packages')).toHaveTextContent('6');
    const lotes = within(abierta).getAllByTestId('order-delivery-entry-batch');
    expect(lotes.map((lote) => lote.getAttribute('data-batch-id'))).toEqual([FIRST_BATCH_ID, SECOND_BATCH_ID]);
    expect(within(lotes[0]!).getByTestId('order-delivery-entry-batch-lot')).toHaveTextContent('L-2026-0101');
    expect(within(lotes[0]!).getByTestId('order-delivery-entry-batch-packages')).toHaveTextContent('4');
    expect(within(lotes[1]!).getByTestId('order-delivery-entry-batch-lot')).toHaveTextContent('L-2026-0102');
    expect(within(lotes[1]!).getByTestId('order-delivery-entry-batch-packages')).toHaveTextContent('2');

    const bruno = cliente(reciente, SECOND_CUSTOMER_ID);
    const galon = presentacion(bruno, VOIDED_LINE_ID);
    expect(within(bruno).getAllByTestId('order-delivery-entry-presentation')).toHaveLength(1);
    expect(within(galon).getByTestId('order-delivery-entry-presentation-name')).toHaveTextContent('Galon 4 L');
    expect(within(galon).getByTestId('order-delivery-entry-presentation-packages')).toHaveTextContent('2');
    const [lote] = within(galon).getAllByTestId('order-delivery-entry-batch');
    expect(lote).toHaveAttribute('data-batch-id', THIRD_BATCH_ID);
    expect(within(lote!).getByTestId('order-delivery-entry-batch-packages')).toHaveTextContent('2');
  });

  it('R33: el subbloque pinta el nombre que trae la vista aunque el cliente este dado de baja', () => {
    const [reciente] = VISTA.deliveries;
    const conBaja: OrderDeliveryHistoryEntry = {
      ...reciente!,
      customers: reciente!.customers.map((customer) =>
        customer.customerId === SECOND_CUSTOMER_ID ? { ...customer, customerName: 'Bruno Diaz (de baja)' } : customer,
      ),
    };
    pintar({ deliveries: [conBaja] });

    expect(
      within(cliente(entrega(NEWER_DELIVERY_ID), SECOND_CUSTOMER_ID)).getByTestId('order-delivery-entry-customer-name'),
    ).toHaveTextContent('Bruno Diaz (de baja)');
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

  it('R34: el par anulado queda marcado «Anulada» en el subbloque de su cliente, con motivo, autor y fecha, junto a sus envases y lotes', () => {
    pintar();

    const anulada = presentacion(cliente(entrega(NEWER_DELIVERY_ID), FIRST_CUSTOMER_ID), VOIDED_LINE_ID);
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

  it('R34: la misma presentacion en el subbloque de otro cliente no sale anulada si su par no lo esta', () => {
    pintar();

    const bruno = cliente(entrega(NEWER_DELIVERY_ID), SECOND_CUSTOMER_ID);
    expect(within(presentacion(bruno, VOIDED_LINE_ID)).queryByTestId('order-delivery-entry-voided')).toBeNull();
    expect(within(bruno).queryByText('Anulada')).toBeNull();
  });

  it('R34: un par sin anular no lleva la marca', () => {
    pintar();

    expect(
      within(presentacion(cliente(entrega(NEWER_DELIVERY_ID), FIRST_CUSTOMER_ID), OPEN_LINE_ID)).queryByTestId(
        'order-delivery-entry-voided',
      ),
    ).toBeNull();
    expect(within(entrega(OLDER_DELIVERY_ID)).queryByTestId('order-delivery-entry-voided')).toBeNull();
  });

  it.each(['TERMINADO', 'ENTREGADO'] as const)(
    'R35: con canVoid y el pedido %s, cada entrega con algun par sin anular ofrece «Anular» y emite la entrega',
    (status) => {
      const onVoid = vi.fn();
      pintar({ orderStatus: status, onVoid });

      expect(screen.getAllByTestId('order-delivery-void')).toHaveLength(2);
      fireEvent.click(within(entrega(OLDER_DELIVERY_ID)).getByTestId('order-delivery-void'));
      expect(onVoid).toHaveBeenCalledExactlyOnceWith(VISTA.deliveries[1]);
    },
  );

  it('R35: sin canVoid la accion no existe en el DOM', () => {
    pintar({ canVoid: false });

    expect(screen.queryByTestId('order-delivery-void')).toBeNull();
    expect(document.querySelector('[data-testid="order-delivery-void"]')).toBeNull();
  });

  it('R35: una entrega con todos sus pares anulados, de todos sus clientes, no ofrece «Anular»', () => {
    const [reciente, antigua] = VISTA.deliveries;
    pintar({ deliveries: [anular(reciente!), antigua!] });

    expect(within(entrega(NEWER_DELIVERY_ID)).queryByTestId('order-delivery-void')).toBeNull();
    expect(within(entrega(OLDER_DELIVERY_ID)).getByTestId('order-delivery-void')).toBeInTheDocument();
  });

  it('R35: con todo lo de un cliente anulado, la entrega sigue ofreciendo «Anular» si a otro cliente le queda un par', () => {
    const [reciente, antigua] = VISTA.deliveries;
    pintar({ deliveries: [anular(reciente!, FIRST_CUSTOMER_ID), antigua!] });

    expect(within(entrega(NEWER_DELIVERY_ID)).getByTestId('order-delivery-void')).toBeInTheDocument();
  });

  it.each(
    ORDER_STATUS_VALUES.filter((status): status is OrderStatus => status !== 'TERMINADO' && status !== 'ENTREGADO'),
  )('R35: con el pedido %s no ofrece «Anular» aunque haya permiso', (status) => {
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
