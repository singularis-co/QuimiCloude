// Página de Contactos: corte por `whatsapp.consultar`, permisos de presentación, carga inicial en
// paralelo (con chat y contexto si la URL trae selección) y estado sin conexión.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONTACTS_EMPTY_TEXT,
  CONTACTS_LOAD_ERROR_RETRY_TESTID,
  CONTACTS_LOAD_ERROR_TESTID,
  CONTACTS_NOT_CONNECTED_TESTID,
  CONTACTS_SCREEN_TESTID,
  CUSTOMER_CONTACTS_TITLE_TESTID,
} from '@/app/(private)/clientes/contactos/components';
import CustomerContactsPage, { metadata } from '@/app/(private)/clientes/contactos/page';
import type { SessionUser } from '@/lib/modules/identity';
import type {
  WhatsappChat,
  WhatsappChatContext,
  WhatsappConversationItem,
  WhatsappConversationList,
} from '@/lib/modules/integraciones';
import { BRAND_LABEL, CUSTOMER_CONTACTS_LABEL } from '@/lib/shared/navigation/private-nav';
import { CUSTOMER_CONTACTS_ROUTE, LOGIN_ROUTE_SESSION_ENDED, WHATSAPP_INTEGRATION_ROUTE } from '@/lib/shared/routes';

const { getSessionUserMock, notFoundMock, redirectMock, refreshMock, actions } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  notFoundMock: vi.fn<() => never>(),
  redirectMock: vi.fn<(ruta: string) => never>(),
  refreshMock: vi.fn(),
  actions: {
    list: vi.fn(),
    templates: vi.fn(),
    getChat: vi.fn(),
    getContext: vi.fn(),
    markRead: vi.fn(),
    getCustomer: vi.fn(),
    send: vi.fn(),
    retry: vi.fn(),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: notFoundMock,
  redirect: redirectMock,
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions', () => ({
  listWhatsappConversationsAction: actions.list,
  listSendableWhatsappTemplatesAction: actions.templates,
  getWhatsappChatAction: actions.getChat,
  getWhatsappChatContextAction: actions.getContext,
  markWhatsappChatReadAction: actions.markRead,
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions', () => ({
  sendWhatsappMessageAction: actions.send,
  retryWhatsappMessageAction: actions.retry,
}));

vi.mock('@/lib/modules/clientes/adapters/driving/customer-actions', () => ({
  getCustomerAction: actions.getCustomer,
}));

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const RAIZ = join(__dirname, '..', '..', '..');
const CARPETA = join(RAIZ, 'app', '(private)', ...CUSTOMER_CONTACTS_ROUTE.split('/').filter(Boolean));
const CONSULTAR = 'whatsapp.consultar';
const ENVIAR = 'whatsapp.enviar';
const INTEGRACIONES = 'integraciones.modificar';
const NO_EXISTE = { status: 'error', code: 'customer_not_found', message: 'El cliente solicitado no existe.' } as const;

function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
}

function fuenteDeLaPagina(): string {
  return readFileSync(join(CARPETA, 'page.tsx'), 'utf8');
}

function sesionCon(permissions: readonly string[]): SessionUser {
  return {
    id: 'u-test-contactos',
    username: 'carla.duarte',
    displayName: 'Carla Duarte Salas',
    roleName: 'Administrador',
    permissions,
  };
}

function exito<T>(data: T) {
  return { status: 'success' as const, data };
}

function conversacion(n: number): WhatsappConversationItem {
  return {
    contactId: `contacto-${n}`,
    customerId: `cliente-${n}`,
    customerName: `Cliente ${n}`,
    phone: `+593 99 000 000${n}`,
    isBlocked: false,
    unreadCount: 0,
    lastMessage: { direction: 'IN', type: 'TEXT', preview: `Hola ${n}`, status: 'RECEIVED', at: new Date().toISOString() },
  };
}

function listado(connectionStatus: WhatsappConversationList['connectionStatus'] = 'ACTIVE'): WhatsappConversationList {
  const items = [conversacion(1), conversacion(2)];
  return { connectionStatus, page: { items, total: items.length, page: 1, pageSize: 25, totalPages: 1 } };
}

function chatVacioDe(customerId: string, name: string): WhatsappChat {
  return {
    connectionStatus: 'ACTIVE',
    contact: null,
    customer: { id: customerId, name },
    window: { open: false, closesAt: null },
    messages: [],
    hasMore: false,
    nextCursor: null,
  };
}

function contextoDe(customerId: string, name: string): WhatsappChatContext {
  return { customer: { id: customerId, name }, orders: [], selectedOrderId: null, values: {} };
}

function clienteConTelefono(id: string, phoneE164: string | null) {
  return exito({ id, name: 'Ferretería Sur', phone: phoneE164, phoneCountry: 'EC', phoneE164, phoneIssue: null });
}

async function pintarPagina(search: Record<string, string> = {}) {
  render(await CustomerContactsPage({ searchParams: Promise.resolve(search) }));
}

function ningunaCargaDeDatos() {
  for (const accion of [actions.list, actions.templates, actions.getChat, actions.getContext, actions.getCustomer]) {
    expect(accion).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  window.history.replaceState(null, '', CUSTOMER_CONTACTS_ROUTE);
  notFoundMock.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  redirectMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
  getSessionUserMock.mockResolvedValue(sesionCon([CONSULTAR, ENVIAR, INTEGRACIONES]));
  actions.list.mockResolvedValue(exito(listado()));
  actions.templates.mockResolvedValue(exito({ templates: [] }));
  actions.getChat.mockResolvedValue(exito(chatVacioDe('cliente-9', 'Ferretería Sur')));
  actions.getContext.mockResolvedValue(exito(contextoDe('cliente-9', 'Ferretería Sur')));
  actions.getCustomer.mockResolvedValue(clienteConTelefono('cliente-9', '593981112233'));
  actions.markRead.mockResolvedValue(exito({ unreadCount: 0 }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('R1 · corte por whatsapp.consultar', () => {
  it('R1: sin sesión redirige al login con la marca de sesión terminada y no pide ningún dato', async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(CustomerContactsPage({ searchParams: Promise.resolve({ cliente: 'cliente-9' }) })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(notFoundMock).not.toHaveBeenCalled();
    ningunaCargaDeDatos();
  });

  it('R1: con sesión sin whatsapp.consultar responde 404 y no pide ningún dato', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(['clientes.consultar', ENVIAR, INTEGRACIONES]));

    await expect(CustomerContactsPage({ searchParams: Promise.resolve({ contacto: 'contacto-1' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
    ningunaCargaDeDatos();
  });

  it('R1: exige whatsapp.consultar una sola vez y como primera sentencia, antes de leer searchParams', () => {
    const fuente = sinComentarios(fuenteDeLaPagina());
    const cortes = [...fuente.matchAll(/requirePagePermission\(([^)]*)\)/g)].map((coincidencia) => coincidencia[1]);
    const cuerpo = /export default async function \w+\([\s\S]*?\)\s*\{\s*([^;]+);/.exec(fuente)?.[1];

    expect(cortes).toEqual([`'${CONSULTAR}'`]);
    expect(cuerpo).toBe(`await requirePagePermission('${CONSULTAR}')`);
  });

  it('R1: con el permiso pinta un único h1 con la etiqueta de Contactos y la pantalla', async () => {
    await pintarPagina();

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toBe(screen.getByTestId(CUSTOMER_CONTACTS_TITLE_TESTID));
    expect(titulos[0]?.textContent).toBe(CUSTOMER_CONTACTS_LABEL);
    expect(screen.getByTestId(CONTACTS_SCREEN_TESTID)).toBeTruthy();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('R1: la metadata sale de la etiqueta de Contactos y la marca', () => {
    expect(metadata.title).toBe(`${CUSTOMER_CONTACTS_LABEL} · ${BRAND_LABEL}`);
  });
});

describe('carga inicial', () => {
  it('sin selección pide la página 1 y las plantillas, y no pide chat, contexto ni cliente', async () => {
    await pintarPagina();

    expect(actions.list).toHaveBeenCalledTimes(1);
    expect(actions.list).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(actions.templates).toHaveBeenCalledTimes(1);
    expect(actions.getChat).not.toHaveBeenCalled();
    expect(actions.getContext).not.toHaveBeenCalled();
    expect(actions.getCustomer).not.toHaveBeenCalled();
  });

  it('pide todo en paralelo: ninguna carga espera a otra', async () => {
    const pendientes: Array<() => void> = [];
    const colgada = <T,>(valor: T) =>
      new Promise<T>((resolve) => {
        pendientes.push(() => resolve(valor));
      });
    actions.list.mockImplementation(() => colgada(exito(listado())));
    actions.templates.mockImplementation(() => colgada(exito({ templates: [] })));
    actions.getChat.mockImplementation(() => colgada(exito(chatVacioDe('cliente-9', 'Ferretería Sur'))));
    actions.getContext.mockImplementation(() => colgada(exito(contextoDe('cliente-9', 'Ferretería Sur'))));
    actions.getCustomer.mockImplementation(() => colgada(clienteConTelefono('cliente-9', '593981112233')));

    const pagina = CustomerContactsPage({ searchParams: Promise.resolve({ cliente: 'cliente-9' }) });
    await vi.waitFor(() => expect(pendientes).toHaveLength(5));
    for (const soltar of pendientes) soltar();
    render(await pagina);

    expect(screen.getByTestId(CONTACTS_SCREEN_TESTID)).toBeTruthy();
  });

  it('R4: si la lista falla muestra su mensaje y «Reintentar» vuelve a pedir la página', async () => {
    actions.list.mockResolvedValue({ status: 'error', code: 'whatsapp_read_failed', message: 'No se pudo leer.' });
    await pintarPagina();

    const error = screen.getByTestId(CONTACTS_LOAD_ERROR_TESTID);
    expect(error.textContent).toContain('No se pudo leer.');
    within(error).getByTestId(CONTACTS_LOAD_ERROR_RETRY_TESTID).click();
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(CONTACTS_SCREEN_TESTID)).toBeNull();
  });

  it('R4: si las plantillas fallan muestra su mensaje en lugar de la pantalla', async () => {
    actions.templates.mockResolvedValue({ status: 'error', code: 'whatsapp_read_failed', message: 'Sin plantillas.' });
    await pintarPagina();

    expect(screen.getByTestId(CONTACTS_LOAD_ERROR_TESTID).textContent).toContain('Sin plantillas.');
    expect(screen.queryByTestId(CONTACTS_SCREEN_TESTID)).toBeNull();
  });
});

describe('R3 · WhatsApp no está conectado', () => {
  it('R3: con connectionStatus null pinta solo el estado sin conexión y el enlace a Integraciones', async () => {
    actions.list.mockResolvedValue(exito(listado(null)));
    await pintarPagina();

    const vacio = screen.getByTestId(CONTACTS_NOT_CONNECTED_TESTID);
    expect(vacio.textContent).toContain(CONTACTS_EMPTY_TEXT.notConnectedTitle);
    expect(vacio.textContent).toContain(CONTACTS_EMPTY_TEXT.notConnectedDescription);
    expect(within(vacio).getByRole('link', { name: CONTACTS_EMPTY_TEXT.openIntegrations }).getAttribute('href')).toBe(
      WHATSAPP_INTEGRATION_ROUTE,
    );
    expect(screen.queryByTestId(CONTACTS_SCREEN_TESTID)).toBeNull();
  });

  it('R3: sin integraciones.modificar no hay enlace «Ir a Integraciones»', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon([CONSULTAR, ENVIAR]));
    actions.list.mockResolvedValue(exito(listado(null)));
    await pintarPagina();

    expect(screen.getByTestId(CONTACTS_NOT_CONNECTED_TESTID)).toBeTruthy();
    expect(screen.queryByRole('link', { name: CONTACTS_EMPTY_TEXT.openIntegrations })).toBeNull();
  });
});

describe('R47 · permiso de envío', () => {
  it('R47: sin whatsapp.enviar el chat abierto no tiene caja de texto', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon([CONSULTAR]));
    await pintarPagina({ cliente: 'cliente-9' });

    expect(screen.getByTestId('chat-header')).toBeTruthy();
    expect(screen.queryByTestId('chat-composer')).toBeNull();
  });

  it('R47: con whatsapp.enviar el chat abierto trae la caja', async () => {
    actions.getChat.mockResolvedValue(
      exito({ ...chatVacioDe('cliente-9', 'Ferretería Sur'), window: { open: true, closesAt: new Date(Date.now() + 3_600_000).toISOString() } }),
    );
    await pintarPagina({ cliente: 'cliente-9' });

    expect(screen.getByTestId('chat-composer')).toBeTruthy();
  });
});

describe('R46 · abrir por cliente', () => {
  it('R46: con ?cliente= abre el chat vacío de ese cliente con el teléfono de su ficha', async () => {
    await pintarPagina({ cliente: 'cliente-9' });

    expect(actions.getChat).toHaveBeenCalledWith({ target: { customerId: 'cliente-9' }, pageSize: 30 });
    expect(actions.getCustomer).toHaveBeenCalledWith('cliente-9');
    const cabecera = screen.getByTestId('chat-header');
    expect(cabecera.textContent).toContain('Ferretería Sur');
    expect(cabecera.textContent).toContain('+593 98 111 2233');
    expect(screen.getByTestId('chat-window-badge').textContent).toContain('Ventana cerrada');
    expect(screen.getByTestId('conversation-list')).toBeTruthy();
  });

  it('R46: si el cliente no tiene teléfono válido, la cabecera no inventa uno', async () => {
    actions.getCustomer.mockResolvedValue(clienteConTelefono('cliente-9', null));
    await pintarPagina({ cliente: 'cliente-9' });

    expect(screen.getByTestId('chat-header').textContent).not.toContain('+593 98');
  });

  it('R46: si el cliente no existe muestra «El cliente solicitado no existe.» junto a la lista', async () => {
    actions.getChat.mockResolvedValue(NO_EXISTE);
    actions.getContext.mockResolvedValue(NO_EXISTE);
    actions.getCustomer.mockResolvedValue(NO_EXISTE);
    await pintarPagina({ cliente: 'cliente-0' });

    expect(screen.getByTestId('chat-load-error').textContent).toContain('El cliente solicitado no existe.');
    expect(screen.getByTestId('conversation-list')).toBeTruthy();
  });

  it('R46: con ?contacto= no pide la ficha del cliente', async () => {
    await pintarPagina({ contacto: 'contacto-1', cliente: 'cliente-9' });

    expect(actions.getChat).toHaveBeenCalledWith({ target: { contactId: 'contacto-1' }, pageSize: 30 });
    expect(actions.getCustomer).not.toHaveBeenCalled();
  });
});

describe('R54 · contexto en la carga inicial', () => {
  it('R54: con selección pide el contexto una sola vez, con el mismo target que el chat', async () => {
    await pintarPagina({ cliente: 'cliente-9' });

    expect(actions.getContext).toHaveBeenCalledTimes(1);
    expect(actions.getContext).toHaveBeenCalledWith({ target: { customerId: 'cliente-9' } });
  });

  it('R54: con ?contacto= el contexto se pide por contacto', async () => {
    await pintarPagina({ contacto: 'contacto-1' });

    expect(actions.getContext).toHaveBeenCalledTimes(1);
    expect(actions.getContext).toHaveBeenCalledWith({ target: { contactId: 'contacto-1' } });
  });
});

describe('frontera', () => {
  it('R48: la página no importa la composición ni construye la URL de un medio', () => {
    const fuente = fuenteDeLaPagina();
    expect(fuente).not.toContain('@/lib/composition');
    expect(fuente).not.toContain('/api/integraciones/whatsapp/media');
  });

  it('la página y sus textos no escriben la etiqueta de Contactos como literal', () => {
    const fuentes = [
      fuenteDeLaPagina(),
      readFileSync(join(CARPETA, 'components', 'index.ts'), 'utf8'),
      readFileSync(join(CARPETA, 'components', 'contact-texts.ts'), 'utf8'),
    ];
    for (const fuente of fuentes) expect(sinComentarios(fuente)).not.toContain(`'${CUSTOMER_CONTACTS_LABEL}'`);
    expect(sinComentarios(fuenteDeLaPagina())).not.toContain(CUSTOMER_CONTACTS_LABEL);
  });
});
