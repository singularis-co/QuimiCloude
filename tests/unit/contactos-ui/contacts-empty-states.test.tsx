// Vacíos de la pantalla: sin conexión (enlace según permiso), sin conversaciones, sin resultados y
// sin chat elegido.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ChatNoSelection,
  ContactsNotConnected,
  ConversationsEmpty,
  ConversationsSearchEmpty,
} from '@/app/(private)/clientes/contactos/components/contacts-empty-states';
import { WHATSAPP_INTEGRATION_ROUTE } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';

afterEach(cleanup);

describe('ContactsNotConnected', () => {
  it('R3: con integraciones.modificar muestra el estado y el enlace «Ir a Integraciones» a WhatsApp', () => {
    render(<ContactsNotConnected canOpenIntegrations />);

    const vacio = screen.getByTestId('contacts-not-connected');
    expect(within(vacio).getByRole('heading', { name: 'WhatsApp no está conectado' })).toBeInTheDocument();
    expect(vacio).toHaveTextContent(
      'Conecta la cuenta de WhatsApp de la empresa para ver y responder las conversaciones con tus clientes.',
    );
    expect(within(vacio).getByRole('link', { name: 'Ir a Integraciones' })).toHaveAttribute(
      'href',
      WHATSAPP_INTEGRATION_ROUTE,
    );
  });

  it('R3: sin integraciones.modificar muestra el estado sin el enlace', () => {
    render(<ContactsNotConnected canOpenIntegrations={false} />);

    expect(screen.getByRole('heading', { name: 'WhatsApp no está conectado' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contacts-integrations-link')).not.toBeInTheDocument();
  });
});

describe('vacíos de la lista', () => {
  it('R12: sin conversaciones muestra el título y el texto de ayuda', () => {
    render(<ConversationsEmpty />);

    expect(screen.getByRole('heading', { name: 'Aún no hay conversaciones' })).toBeInTheDocument();
    expect(
      screen.getByText('Cuando un cliente te escriba por WhatsApp, o abras un chat desde Clientes, aparecerá aquí.'),
    ).toBeInTheDocument();
  });

  it('R12: el vacío de búsqueda ofrece limpiarla', async () => {
    const user = setupUser();
    const onClearSearch = vi.fn();
    render(<ConversationsSearchEmpty onClearSearch={onClearSearch} />);

    expect(screen.getByText('No hay conversaciones que coincidan con la búsqueda.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar la búsqueda' }));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });
});

describe('ChatNoSelection', () => {
  it('R5: sin chat elegido muestra el estado neutro', () => {
    render(<ChatNoSelection />);

    expect(screen.getByTestId('chat-no-selection')).toHaveTextContent('Elige una conversación para verla aquí.');
  });
});
