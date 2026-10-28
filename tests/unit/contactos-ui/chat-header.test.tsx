// Cabecera del chat: volver, nombre, teléfono, ventana de 24 h con su cuenta atrás, selector
// «Pedido», flecha del detalle y error al cambiar de pedido.

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatHeader, type ChatHeaderProps } from '@/app/(private)/clientes/contactos/components/chat-header';
import type { ChatContextView, ChatOrderView } from '@/app/(private)/clientes/contactos/components/chat-view';
import { ChatWindowBadge } from '@/app/(private)/clientes/contactos/components/chat-window-badge';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const CLIENTE = 'Distribuidora El Roble';
const TELEFONO = '+593 98 455 2107';
const AHORA = new Date(2026, 9, 23, 10, 0);
const CERRADA = { open: false, closesAt: null } as const;

function abierta(minutos: number) {
  return { open: true, closesAt: new Date(AHORA.getTime() + minutos * 60_000).toISOString() } as const;
}

function pedido(overrides: Partial<ChatOrderView> = {}): ChatOrderView {
  return {
    id: 'p131',
    number: 'PED-00131',
    statusLabel: 'En producción',
    productName: 'Desinfectante amonio cuaternario',
    totalLabel: null,
    lines: [
      { key: 'l1', ordered: '10 × Bidón 20 L', delivered: 6, pending: 4 },
      { key: 'l2', ordered: '15 × Galón 4 L', delivered: 0, pending: 15 },
    ],
    ...overrides,
  };
}

const SEGUNDO = pedido({ id: 'p124', number: 'PED-00124', statusLabel: 'Entregado', lines: [] });

function contexto(orders: readonly ChatOrderView[], selectedOrderId = orders[0]?.id ?? null): ChatContextView {
  return { orders, selectedOrderId, values: {} };
}

function pintar(overrides: Partial<ChatHeaderProps> = {}) {
  const props: ChatHeaderProps = {
    customerName: CLIENTE,
    phone: TELEFONO,
    window: CERRADA,
    context: contexto([]),
    contextLoading: false,
    orderError: null,
    onSelectOrder: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
  const view = render(<ChatHeader {...props} />);
  return { ...view, props };
}

const flecha = () => screen.getByRole('button', { name: 'Ver detalles del pedido' });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('R15 · cabecera con nombre, teléfono y ventana', () => {
  it('R15: pinta el nombre del cliente y el teléfono', () => {
    pintar();
    expect(screen.getByText(CLIENTE)).toBeTruthy();
    expect(screen.getByText(TELEFONO)).toBeTruthy();
  });

  it('R15: con la ventana abierta y más de una hora, «se cierra en H h M min»', () => {
    vi.useFakeTimers({ now: AHORA });
    pintar({ window: abierta(21 * 60 + 18) });
    expect(screen.getByText('Ventana abierta · se cierra en 21 h 18 min')).toBeTruthy();
  });

  it('R15: con menos de una hora, «se cierra en M min»', () => {
    vi.useFakeTimers({ now: AHORA });
    pintar({ window: abierta(42) });
    expect(screen.getByText('Ventana abierta · se cierra en 42 min')).toBeTruthy();
  });

  it('R15: con la ventana cerrada, «Ventana cerrada»', () => {
    pintar({ window: CERRADA });
    expect(screen.getByText('Ventana cerrada')).toBeTruthy();
  });
});

describe('R16 · cuenta atrás sin recargar', () => {
  it('R16: recalcula el tiempo restante cada minuto', () => {
    vi.useFakeTimers({ now: AHORA });
    render(<ChatWindowBadge window={abierta(3)} />);
    expect(screen.getByText('Ventana abierta · se cierra en 3 min')).toBeTruthy();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Ventana abierta · se cierra en 2 min')).toBeTruthy();
  });

  it('R16: al llegar `closesAt` pasa sola a «Ventana cerrada»', () => {
    vi.useFakeTimers({ now: AHORA });
    render(<ChatWindowBadge window={abierta(2)} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Ventana abierta · se cierra en 1 min')).toBeTruthy();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Ventana cerrada')).toBeTruthy();
    expect(screen.queryByText(/Ventana abierta/)).toBeNull();
  });
});

describe('R38 · selector «Pedido»', () => {
  it('R38: sin pedidos no hay selector ni flecha', () => {
    pintar({ context: contexto([]) });
    expect(screen.queryByText('Pedido')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver detalles del pedido' })).toBeNull();
  });

  it('R38: con un solo pedido abierto no hay selector', () => {
    pintar({ context: contexto([pedido()]) });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(flecha()).toBeTruthy();
  });

  it('R38: con más de uno, el selector lista los pedidos por número, en orden, con `selectedOrderId` elegido', async () => {
    const user = setupUser();
    pintar({ context: contexto([pedido(), SEGUNDO], 'p124') });
    const selector = screen.getByRole('combobox', { name: 'Pedido' });
    expect(selector.textContent).toContain('PED-00124');

    await user.click(selector);
    const opciones = await screen.findAllByRole('option');
    expect(opciones.map((opcion) => opcion.textContent)).toEqual(['PED-00131', 'PED-00124']);
  });

  it('R38: al elegir otro pedido llama a `onSelectOrder` con su id', async () => {
    const user = setupUser();
    const { props } = pintar({ context: contexto([pedido(), SEGUNDO], 'p131') });
    await user.click(screen.getByRole('combobox', { name: 'Pedido' }));
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'PED-00124' })));
    expect(props.onSelectOrder).toHaveBeenCalledWith('p124');
  });

  it('R38: mientras carga el contexto el selector queda deshabilitado', () => {
    pintar({ context: contexto([pedido(), SEGUNDO]), contextLoading: true });
    const selector = screen.getByRole('combobox', { name: 'Pedido' });
    expect(selector.getAttribute('aria-busy')).toBe('true');
    expect(selector.hasAttribute('disabled') || selector.getAttribute('aria-disabled') === 'true').toBe(true);
  });
});

describe('R39 · detalle del pedido', () => {
  it('R39: la flecha despliega y pliega el detalle con `aria-expanded` y `aria-controls`', async () => {
    const user = setupUser();
    pintar({ context: contexto([pedido()]) });
    expect(flecha().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('chat-order-detail')).toBeNull();

    await user.click(flecha());
    expect(flecha().getAttribute('aria-expanded')).toBe('true');
    const controla = flecha().getAttribute('aria-controls');
    expect(controla).toBeTruthy();
    const panel = document.getElementById(controla ?? '');
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByTestId('chat-order-detail')).toBeTruthy();

    await user.click(flecha());
    expect(flecha().getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(screen.queryByTestId('chat-order-detail')).toBeNull());
  });

  it('R39: muestra número, estado, producto y una fila por línea con pedido, entregado y faltante', async () => {
    const user = setupUser();
    pintar({ context: contexto([pedido()]) });
    await user.click(flecha());
    const detalle = screen.getByTestId('chat-order-detail');
    expect(within(detalle).getByText('PED-00131')).toBeTruthy();
    expect(within(detalle).getByText('En producción')).toBeTruthy();
    expect(within(detalle).getByText('Desinfectante amonio cuaternario')).toBeTruthy();

    const filas = within(detalle).getAllByRole('row').slice(1);
    expect(filas.map((fila) => within(fila).getAllByRole('cell').map((celda) => celda.textContent))).toEqual([
      ['10 × Bidón 20 L', '6', '4'],
      ['15 × Galón 4 L', '0', '15'],
    ]);
  });

  it('R39: el detalle es el del pedido elegido', async () => {
    const user = setupUser();
    pintar({ context: contexto([pedido(), SEGUNDO], 'p124') });
    await user.click(flecha());
    const detalle = screen.getByTestId('chat-order-detail');
    expect(within(detalle).getByText('PED-00124')).toBeTruthy();
    expect(within(detalle).getByText('Entregado')).toBeTruthy();
  });

  it('R39: sin nombre de producto no pinta la fila del producto', async () => {
    const user = setupUser();
    pintar({ context: contexto([pedido({ productName: null })]) });
    await user.click(flecha());
    expect(within(screen.getByTestId('chat-order-detail')).queryByText('Producto')).toBeNull();
  });

  it('R39: con total `null` oculta la fila del total', async () => {
    const user = setupUser();
    pintar({ context: contexto([pedido({ totalLabel: null })]) });
    await user.click(flecha());
    expect(within(screen.getByTestId('chat-order-detail')).queryByText('Total')).toBeNull();
  });

  it('R39: con total, lo muestra', async () => {
    const user = setupUser();
    pintar({ context: contexto([pedido({ totalLabel: '$ 412,50' })]) });
    await user.click(flecha());
    const detalle = screen.getByTestId('chat-order-detail');
    expect(within(detalle).getByText('Total')).toBeTruthy();
    expect(within(detalle).getByText('$ 412,50')).toBeTruthy();
  });

  it('R39: no muestra fecha de entrega', async () => {
    const user = setupUser();
    pintar({ context: contexto([pedido({ totalLabel: '$ 412,50' })]) });
    await user.click(flecha());
    const detalle = screen.getByTestId('chat-order-detail');
    expect(detalle.textContent).not.toMatch(/fecha|entrega:/i);
    expect(detalle.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe('R6 · volver a la lista en teléfono', () => {
  it('R6: «Volver a conversaciones» llama a su callback', async () => {
    const user = setupUser();
    const { props } = pintar();
    await user.click(screen.getByRole('button', { name: 'Volver a conversaciones' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});

describe('R54 · error al cambiar de pedido', () => {
  it('R54: pinta el `message` del error junto al selector y lo enlaza a él', () => {
    pintar({
      context: contexto([pedido(), SEGUNDO], 'p131'),
      orderError: { status: 'error', code: 'order_not_found', message: 'El pedido solicitado no existe.' },
    });
    const error = screen.getByTestId('chat-order-error');
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toContain('El pedido solicitado no existe.');

    const selector = screen.getByRole('combobox', { name: 'Pedido' });
    expect(selector.getAttribute('aria-describedby')).toBe(error.id);
    expect(selector.parentElement?.parentElement?.contains(error)).toBe(true);
    expect(selector.textContent).toContain('PED-00131');
  });
});
