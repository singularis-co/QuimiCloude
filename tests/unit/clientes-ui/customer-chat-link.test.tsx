// «Abrir chat» desde la lista de Clientes: enlace, texto sin teléfono válido y nada sin permiso.
//
// Se prueba la pieza sola y montada en la celda de acciones de `buildCustomerColumns`, que es
// la misma celda que pinta la tabla en escritorio y en teléfono.

import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ACTIONS_COLUMN_ID,
  CUSTOMER_CHAT_LINK_TESTID,
  CUSTOMER_CHAT_LINK_TEXT,
  CUSTOMER_CHAT_UNAVAILABLE_TESTID,
  CUSTOMER_CHAT_UNAVAILABLE_TEXT,
  CustomerChatLink,
  buildCustomerColumns,
  customerChatHref,
} from '@/app/(private)/clientes/components';
import { CONTACTS_SELECTION_PARAMS } from '@/app/(private)/clientes/contactos/components';
import type { CustomerView } from '@/lib/modules/clientes';
import { CUSTOMER_CONTACTS_ROUTE } from '@/lib/shared/routes';

const ID = '11111111-1111-4111-8111-111111111111';

function cliente(overrides: Partial<CustomerView> = {}): CustomerView {
  return {
    id: ID,
    firstNames: 'María',
    lastNames: 'Gómez',
    city: 'Bogotá',
    phone: '3001234567',
    phoneCountry: 'CO',
    phoneE164: '573001234567',
    phoneIssue: null,
    email: null,
    address: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-20T10:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

const SIN_TELEFONO: Partial<CustomerView> = { phone: null, phoneCountry: null, phoneE164: null };
const CON_INCIDENCIA: Partial<CustomerView> = { phoneE164: null, phoneIssue: 'invalid_format' };

function celdaDeAcciones(customer: CustomerView, canChat: boolean) {
  const columna = buildCustomerColumns({
    rowActions: () => <span data-testid="fila-accion" />,
    canChat,
  }).find((c) => c.id === ACTIONS_COLUMN_ID);
  if (columna === undefined) throw new Error('falta la columna de acciones');
  return render(<>{columna.cell(customer)}</>);
}

afterEach(() => {
  cleanup();
});

describe('R45 — con `whatsapp.consultar` y teléfono válido, «Abrir chat» lleva al chat del cliente', () => {
  it('R45 — el enlace apunta a la ruta de contactos con `?cliente=<id>`', () => {
    render(<CustomerChatLink customer={cliente()} canChat />);

    const enlace = screen.getByRole('link', { name: /Abrir chat/ });
    const href = enlace.getAttribute('href') ?? '';
    const [ruta, consulta] = href.split('?');

    expect(enlace).toHaveAttribute('data-testid', `${CUSTOMER_CHAT_LINK_TESTID}-${ID}`);
    expect(enlace).toHaveTextContent(CUSTOMER_CHAT_LINK_TEXT);
    expect(ruta).toBe(CUSTOMER_CONTACTS_ROUTE);
    expect(new URLSearchParams(consulta).get(CONTACTS_SELECTION_PARAMS.customer)).toBe(ID);
    expect(href).toBe(customerChatHref(ID));
    expect(screen.queryByTestId(`${CUSTOMER_CHAT_UNAVAILABLE_TESTID}-${ID}`)).toBeNull();
  });

  it('R45 — el nombre accesible nombra al cliente y contiene el texto visible', () => {
    render(<CustomerChatLink customer={cliente()} canChat />);

    expect(screen.getByRole('link', { name: `${CUSTOMER_CHAT_LINK_TEXT} de María Gómez` })).toBeInTheDocument();
  });

  it('R45 — el identificador se codifica en la consulta', () => {
    const raro = 'a b&c';
    const href = customerChatHref(raro);

    expect(new URLSearchParams(href.split('?')[1]).get(CONTACTS_SELECTION_PARAMS.customer)).toBe(raro);
  });

  it('R45 — el enlace tiene área táctil de 44 px', () => {
    render(<CustomerChatLink customer={cliente()} canChat />);

    expect(screen.getByRole('link').className).toMatch(/min-h-11/);
  });

  it('R45 — en la celda de acciones va delante de las acciones de fila', () => {
    celdaDeAcciones(cliente(), true);

    const enlace = screen.getByTestId(`${CUSTOMER_CHAT_LINK_TESTID}-${ID}`);
    const acciones = screen.getByTestId('fila-accion');
    expect(enlace.compareDocumentPosition(acciones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('R45 — con `whatsapp.consultar` y sin teléfono válido, «Sin teléfono válido»', () => {
  it.each([
    ['sin teléfono', SIN_TELEFONO],
    ['con teléfono heredado sin E.164', { phoneE164: null }],
    ['con incidencia en el teléfono', CON_INCIDENCIA],
  ])('R45 — %s pinta el texto y ningún enlace', (_caso, overrides) => {
    render(<CustomerChatLink customer={cliente(overrides)} canChat />);

    expect(screen.getByTestId(`${CUSTOMER_CHAT_UNAVAILABLE_TESTID}-${ID}`)).toHaveTextContent(
      CUSTOMER_CHAT_UNAVAILABLE_TEXT,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('R45 — con E.164 pero con incidencia tampoco hay enlace', () => {
    render(
      <CustomerChatLink
        customer={cliente({ phoneIssue: 'duplicate' })}
        canChat
      />,
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId(`${CUSTOMER_CHAT_UNAVAILABLE_TESTID}-${ID}`)).toBeInTheDocument();
  });
});

describe('R45 — sin `whatsapp.consultar` no se pinta ninguno de los dos', () => {
  it.each([
    ['con teléfono válido', {}],
    ['sin teléfono', SIN_TELEFONO],
  ])('R45 — %s el componente no emite nada', (_caso, overrides) => {
    const { container } = render(<CustomerChatLink customer={cliente(overrides)} canChat={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('R45 — la celda de acciones queda tal cual la entrega el slot', () => {
    celdaDeAcciones(cliente(), false);

    expect(screen.queryByTestId(`${CUSTOMER_CHAT_LINK_TESTID}-${ID}`)).toBeNull();
    expect(screen.queryByTestId(`${CUSTOMER_CHAT_UNAVAILABLE_TESTID}-${ID}`)).toBeNull();
    expect(screen.getByTestId('fila-accion')).toBeInTheDocument();
  });

  it('R45 — por defecto, sin `canChat`, la columna no pinta el chat', () => {
    const columna = buildCustomerColumns({ rowActions: () => null }).find((c) => c.id === ACTIONS_COLUMN_ID);
    const { container } = render(<>{columna?.cell(cliente())}</>);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('R45 — la ruta del enlace no se escribe a mano', () => {
  it('R45 — el componente no contiene el literal de la ruta de contactos', () => {
    const fuente = readFileSync(
      join(process.cwd(), 'app/(private)/clientes/components/customer-chat-link.tsx'),
      'utf8',
    );

    expect(fuente).toContain('CUSTOMER_CONTACTS_ROUTE');
    expect(fuente).not.toContain(CUSTOMER_CONTACTS_ROUTE);
  });
});
