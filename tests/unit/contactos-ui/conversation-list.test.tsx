// Lista de conversaciones: filas, etiqueta del tipo sin vista previa, búsqueda con pausa, vacíos,
// página siguiente por el centinela y selección.

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatListTime } from '@/app/(private)/clientes/contactos/components/chat-time-format';
import {
  ConversationList,
  useConversationList,
  type ConversationListController,
} from '@/app/(private)/clientes/contactos/components/conversation-list';
import type { ErrorState } from '@/lib/modules/errores';
import type {
  WhatsappConversationItem,
  WhatsappConversationList,
  WhatsappMessageType,
} from '@/lib/modules/integraciones';

import { setupUser } from '../../helpers/user-event';

const actions = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions', () => ({
  listWhatsappConversationsAction: actions.list,
}));

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.disconnected = true;
    this.targets.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger() {
    const entries = [...this.targets].map((target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry);
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

function mostrarCentinela() {
  act(() => {
    for (const observer of FakeIntersectionObserver.instances) {
      if (!observer.disconnected) observer.trigger();
    }
  });
}

type Page = WhatsappConversationList['page'];

const HACE_MINUTOS = new Date(Date.now() - 5 * 60_000).toISOString();

function conversacion(n: number, overrides: Partial<WhatsappConversationItem> = {}): WhatsappConversationItem {
  return {
    contactId: `contacto-${n}`,
    customerId: `cliente-${n}`,
    customerName: `Cliente ${n}`,
    phone: `+593 99 000 00${String(n).padStart(2, '0')}`,
    isBlocked: false,
    unreadCount: 0,
    lastMessage: { direction: 'IN', type: 'TEXT', preview: `Hola ${n}`, status: 'RECEIVED', at: HACE_MINUTOS },
    ...overrides,
  };
}

function pagina(items: WhatsappConversationItem[], page = 1, totalPages = 1): Page {
  return { items, total: items.length, page, pageSize: 25, totalPages };
}

function respuesta(page: Page) {
  return { status: 'success' as const, data: { connectionStatus: 'CONNECTED', page } };
}

const ERROR: ErrorState = { status: 'error', code: 'unauthorized', message: 'La búsqueda no es válida.' };

function diferida<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type HarnessProps = {
  readonly initialPage: Page;
  readonly selectedContactId?: string | null;
  readonly onSelect?: (item: WhatsappConversationItem) => void;
  readonly onController?: (controller: ConversationListController) => void;
};

function Harness({ initialPage, selectedContactId = null, onSelect = () => {}, onController }: HarnessProps) {
  const list = useConversationList(initialPage);
  onController?.(list);
  return <ConversationList list={list} selectedContactId={selectedContactId} onSelect={onSelect} />;
}

function filas() {
  return screen.queryAllByTestId('conversation-item');
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  actions.list.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ConversationList', () => {
  it('R8: pinta nombre, teléfono, vista previa, hora y contador «N sin leer» en el orden del servidor', () => {
    const items = [
      conversacion(3, { unreadCount: 4, customerName: 'Laboratorios Andinos' }),
      conversacion(1, { customerName: 'Distribuidora El Roble' }),
      conversacion(2, { customerName: 'Farmacia San Blas' }),
    ];
    render(<Harness initialPage={pagina(items)} />);

    const rows = filas();
    expect(rows.map((row) => row.getAttribute('data-contact-id'))).toEqual(['contacto-3', 'contacto-1', 'contacto-2']);

    const primera = within(rows[0]!);
    expect(primera.getByText('Laboratorios Andinos')).toBeInTheDocument();
    expect(primera.getByText('+593 99 000 0003')).toBeInTheDocument();
    expect(primera.getByText('Hola 3')).toBeInTheDocument();
    expect(primera.getByText(formatListTime(HACE_MINUTOS, new Date()))).toBeInTheDocument();
    expect(primera.getByRole('img', { name: '4 sin leer' })).toHaveTextContent('4');

    expect(within(rows[1]!).queryByTestId('conversation-unread')).not.toBeInTheDocument();
  });

  it.each<[WhatsappMessageType, string]>([
    ['IMAGE', '[Imagen]'],
    ['STICKER', '[Sticker]'],
    ['AUDIO', '[Audio]'],
    ['VIDEO', '[Video]'],
    ['DOCUMENT', '[Documento]'],
    ['LOCATION', '[Ubicación]'],
    ['REACTION', 'Reacción'],
    ['UNSUPPORTED', 'Mensaje no soportado'],
    ['CONTACTS', 'Mensaje no soportado'],
  ])('R9: sin vista previa, un último mensaje %s muestra «%s»', (type, label) => {
    const item = conversacion(1, {
      lastMessage: { direction: 'IN', type, preview: null, status: 'RECEIVED', at: HACE_MINUTOS },
    });
    render(<Harness initialPage={pagina([item])} />);

    expect(within(filas()[0]!).getByText(label)).toBeInTheDocument();
  });

  it('R9: con vista previa la muestra en vez de la etiqueta del tipo', () => {
    const item = conversacion(1, {
      lastMessage: { direction: 'IN', type: 'IMAGE', preview: 'Foto del bidón', status: 'RECEIVED', at: HACE_MINUTOS },
    });
    render(<Harness initialPage={pagina([item])} />);

    expect(within(filas()[0]!).getByText('Foto del bidón')).toBeInTheDocument();
    expect(screen.queryByText('[Imagen]')).not.toBeInTheDocument();
  });

  it('R11: tras la pausa al escribir pide la página 1 con el texto y reemplaza la lista', async () => {
    const user = setupUser();
    actions.list.mockResolvedValue(respuesta(pagina([conversacion(9, { customerName: 'Hotel Mirador' })])));
    render(<Harness initialPage={pagina([conversacion(1), conversacion(2)], 1, 3)} />);

    const buscador = screen.getByRole('searchbox', { name: 'Buscar conversación' });
    expect(buscador).toHaveAttribute('placeholder', 'Buscar por nombre o teléfono');
    expect(buscador).toHaveAttribute('maxlength', '100');

    await user.type(buscador, 'Hotel');
    expect(actions.list).not.toHaveBeenCalled();

    await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(1));
    expect(actions.list).toHaveBeenCalledWith({ search: 'Hotel', page: 1, pageSize: 25 });
    await waitFor(() => expect(filas()).toHaveLength(1));
    expect(screen.getByText('Hotel Mirador')).toBeInTheDocument();
    expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument();
  });

  it('R11: una búsqueda nueva descarta la respuesta tardía de la anterior', async () => {
    const user = setupUser();
    const lenta = diferida<ReturnType<typeof respuesta>>();
    actions.list
      .mockReturnValueOnce(lenta.promise)
      .mockResolvedValueOnce(respuesta(pagina([conversacion(7, { customerName: 'Taller Vásconez' })])));
    render(<Harness initialPage={pagina([conversacion(1)])} />);

    const buscador = screen.getByRole('searchbox', { name: 'Buscar conversación' });
    await user.type(buscador, 'Hot');
    await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(1));
    await user.clear(buscador);
    await user.type(buscador, 'Taller');
    await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(2));
    expect(actions.list).toHaveBeenLastCalledWith({ search: 'Taller', page: 1, pageSize: 25 });
    await waitFor(() => expect(screen.getByText('Taller Vásconez')).toBeInTheDocument());

    await act(async () => lenta.resolve(respuesta(pagina([conversacion(8, { customerName: 'Hotel Mirador' })]))));
    expect(screen.queryByText('Hotel Mirador')).not.toBeInTheDocument();
    expect(screen.getByText('Taller Vásconez')).toBeInTheDocument();
  });

  it('R4: si la búsqueda falla muestra el mensaje y «Reintentar» la repite', async () => {
    const user = setupUser();
    actions.list.mockResolvedValueOnce(ERROR).mockResolvedValueOnce(respuesta(pagina([conversacion(5)])));
    render(<Harness initialPage={pagina([conversacion(1)])} />);

    await user.type(screen.getByRole('searchbox'), 'x');
    const alerta = await screen.findByTestId('conversations-error');
    expect(alerta).toHaveTextContent('La búsqueda no es válida.');

    await user.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Cliente 5')).toBeInTheDocument());
    expect(actions.list).toHaveBeenLastCalledWith({ search: 'x', page: 1, pageSize: 25 });
  });

  it('R12: sin búsqueda y sin conversaciones muestra «Aún no hay conversaciones»', () => {
    render(<Harness initialPage={pagina([])} />);

    const vacio = screen.getByTestId('conversations-empty');
    expect(within(vacio).getByRole('heading', { name: 'Aún no hay conversaciones' })).toBeInTheDocument();
    expect(vacio).toHaveTextContent(
      'Cuando un cliente te escriba por WhatsApp, o abras un chat desde Clientes, aparecerá aquí.',
    );
    expect(screen.queryByTestId('conversations-search-empty')).not.toBeInTheDocument();
  });

  it('R12: con búsqueda sin resultados muestra su vacío y limpiarla vuelve a pedir sin texto', async () => {
    const user = setupUser();
    actions.list
      .mockResolvedValueOnce(respuesta(pagina([])))
      .mockResolvedValueOnce(respuesta(pagina([conversacion(1), conversacion(2)])));
    render(<Harness initialPage={pagina([conversacion(1), conversacion(2)])} />);

    const buscador = screen.getByRole('searchbox');
    await user.type(buscador, 'zzz');
    const vacio = await screen.findByTestId('conversations-search-empty');
    expect(vacio).toHaveTextContent('No hay conversaciones que coincidan con la búsqueda.');
    expect(screen.queryByTestId('conversations-empty')).not.toBeInTheDocument();

    await user.click(within(vacio).getByRole('button', { name: 'Limpiar la búsqueda' }));
    expect(buscador).toHaveValue('');
    expect(actions.list).toHaveBeenLastCalledWith({ search: '', page: 1, pageSize: 25 });
    await waitFor(() => expect(filas()).toHaveLength(2));
  });

  it('R13: al verse el centinela pide la página siguiente, muestra «Cargando más conversaciones…» y la añade sin repetir', async () => {
    const siguiente = diferida<ReturnType<typeof respuesta>>();
    actions.list.mockReturnValueOnce(siguiente.promise);
    render(<Harness initialPage={pagina([conversacion(1), conversacion(2)], 1, 3)} />);

    expect(screen.getByTestId('conversations-sentinel')).toBeInTheDocument();
    mostrarCentinela();

    expect(actions.list).toHaveBeenCalledWith({ search: '', page: 2, pageSize: 25 });
    expect(screen.getByRole('status')).toHaveTextContent('Cargando más conversaciones…');

    mostrarCentinela();
    expect(actions.list).toHaveBeenCalledTimes(1);

    await act(async () => siguiente.resolve(respuesta(pagina([conversacion(2), conversacion(3)], 2, 3))));

    expect(filas().map((row) => row.getAttribute('data-contact-id'))).toEqual(['contacto-1', 'contacto-2', 'contacto-3']);
    expect(screen.queryByTestId('conversations-loading-more')).not.toBeInTheDocument();
  });

  it('R13: sin más páginas no hay centinela ni petición', () => {
    render(<Harness initialPage={pagina([conversacion(1)], 1, 1)} />);

    expect(screen.queryByTestId('conversations-sentinel')).not.toBeInTheDocument();
    mostrarCentinela();
    expect(actions.list).not.toHaveBeenCalled();
  });

  it('R13: la página siguiente usa la búsqueda vigente', async () => {
    const user = setupUser();
    actions.list
      .mockResolvedValueOnce(respuesta(pagina([conversacion(4)], 1, 2)))
      .mockResolvedValueOnce(respuesta(pagina([conversacion(5)], 2, 2)));
    render(<Harness initialPage={pagina([conversacion(1)])} />);

    await user.type(screen.getByRole('searchbox'), 'Andinos');
    await waitFor(() => expect(screen.getByText('Cliente 4')).toBeInTheDocument());
    mostrarCentinela();

    expect(actions.list).toHaveBeenLastCalledWith({ search: 'Andinos', page: 2, pageSize: 25 });
    await waitFor(() => expect(screen.getByText('Cliente 5')).toBeInTheDocument());
  });

  it('R14: al pulsar una conversación avisa con ella y la seleccionada queda marcada', async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const items = [conversacion(1), conversacion(2)];
    const { rerender } = render(<Harness initialPage={pagina(items)} onSelect={onSelect} />);

    await user.click(filas()[1]!);
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    expect(filas().some((row) => row.hasAttribute('aria-current'))).toBe(false);

    rerender(<Harness initialPage={pagina(items)} onSelect={onSelect} selectedContactId="contacto-2" />);
    expect(filas()[1]).toHaveAttribute('aria-current', 'true');
    expect(filas()[0]).not.toHaveAttribute('aria-current');
  });

  it('R27: marcar leída una conversación pone su contador a 0', () => {
    let controller!: ConversationListController;
    render(
      <Harness
        initialPage={pagina([conversacion(1, { unreadCount: 2 })])}
        onController={(value) => {
          controller = value;
        }}
      />,
    );
    expect(screen.getByRole('img', { name: '2 sin leer' })).toBeInTheDocument();

    act(() => controller.markRead('contacto-1'));
    expect(screen.queryByTestId('conversation-unread')).not.toBeInTheDocument();
  });

  it('R42: la página 1 de la consulta periódica se fusiona solo si es de la búsqueda vigente', () => {
    let controller!: ConversationListController;
    render(
      <Harness
        initialPage={pagina([conversacion(1), conversacion(2)])}
        onController={(value) => {
          controller = value;
        }}
      />,
    );

    act(() => controller.mergePolled('otra', pagina([conversacion(9)])));
    expect(filas()).toHaveLength(2);

    act(() => controller.mergePolled('', pagina([conversacion(3), conversacion(1)])));
    expect(filas().map((row) => row.getAttribute('data-contact-id'))).toEqual(['contacto-3', 'contacto-1', 'contacto-2']);
  });
});
