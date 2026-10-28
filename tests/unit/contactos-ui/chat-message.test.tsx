// La burbuja de un mensaje del chat: autor, estado, tipos, imagen con visor, sticker, ubicación,
// reacción pegada y «Reintentar».

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '@/app/(private)/clientes/contactos/components/chat-message';
import type { ChatMessageView } from '@/app/(private)/clientes/contactos/components/chat-view';

import { setupUser } from '../../helpers/user-event';

const CLIENTE = 'Distribuidora El Roble';
// Fecha local: la hora pintada no depende de la zona del equipo que corre el test.
const AT = new Date(2026, 9, 23, 10, 40).toISOString();

function mensaje(overrides: Partial<ChatMessageView> = {}): ChatMessageView {
  return {
    id: 'm1',
    side: 'out',
    at: AT,
    author: { kind: 'user', name: 'Camilo' },
    delivery: 'sent',
    errorReason: null,
    retryable: false,
    content: { kind: 'text', text: 'Hola' },
    reaction: null,
    ...overrides,
  };
}

function entrante(content: ChatMessageView['content'], overrides: Partial<ChatMessageView> = {}): ChatMessageView {
  return mensaje({ side: 'in', author: null, delivery: null, content, ...overrides });
}

function pintar(message: ChatMessageView, { canSend = true, onRetry = vi.fn() } = {}) {
  render(<ChatMessage message={message} customerName={CLIENTE} canSend={canSend} onRetry={onRetry} />);
  return { onRetry };
}

afterEach(() => {
  cleanup();
});

describe('R18 · autor del saliente', () => {
  it('R18: un saliente de usuario muestra el nombre de quien lo envió', () => {
    pintar(mensaje());
    expect(screen.getByText('Camilo')).toBeInTheDocument();
  });

  it('R18: un saliente de sistema muestra «Sistema»', () => {
    pintar(mensaje({ author: { kind: 'system' } }));
    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('R18: un entrante no muestra autor', () => {
    pintar(entrante({ kind: 'text', text: 'Hola' }));
    expect(screen.queryByText('Camilo')).toBeNull();
    expect(screen.queryByText('Sistema')).toBeNull();
  });
});

describe('R19 · estado del saliente', () => {
  it.each([
    ['sending', 'Enviando'],
    ['sent', 'Enviado'],
    ['delivered', 'Entregado'],
    ['read', 'Leído'],
  ] as const)('R19: %s se pinta con icono y nombre accesible «%s»', (delivery, nombre) => {
    pintar(mensaje({ delivery }));
    expect(screen.getByRole('img', { name: nombre })).toBeInTheDocument();
  });

  it('R19: un fallido va en tono de error con «No se pudo enviar: <motivo>»', () => {
    pintar(mensaje({ delivery: 'failed', errorReason: 'Número no válido' }));
    expect(screen.getByText('No se pudo enviar: Número no válido')).toBeInTheDocument();
    expect(screen.getByTestId('chat-message')).toHaveAttribute('data-delivery', 'failed');
    expect(screen.getByTestId('chat-message').className).toContain('bg-destructive-subtle');
  });

  it('R19: la hora del mensaje va en HH:mm', () => {
    pintar(mensaje());
    expect(screen.getByText('10:40')).toBeInTheDocument();
  });
});

describe('R20 · pintado por tipo', () => {
  it('R20: el cuerpo de texto se pinta como texto', () => {
    pintar(entrante({ kind: 'text', text: 'Buenos días' }));
    expect(screen.getByText('Buenos días')).toBeInTheDocument();
  });

  it.each(['[Audio]', '[Video]', '[Documento]'] as const)('R20: %s se pinta como etiqueta con su caption', (label) => {
    pintar(entrante({ kind: 'label', label, caption: 'La ficha' }));
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('La ficha')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('R20: un mensaje sin contenido que pintar es «Mensaje no soportado»', () => {
    pintar(entrante({ kind: 'unsupported' }));
    expect(screen.getByText('Mensaje no soportado')).toBeInTheDocument();
  });
});

describe('R21 · imagen con visor', () => {
  const conSrc = entrante({ kind: 'image', src: '/api/integraciones/whatsapp/media/m1', caption: 'La etiqueta' });

  it('R21: con src muestra la miniatura y el caption, y abre el visor con cliente y hora', async () => {
    const user = setupUser();
    pintar(conSrc);

    expect(screen.getByRole('img', { name: 'La etiqueta' })).toHaveAttribute('src', '/api/integraciones/whatsapp/media/m1');
    expect(screen.getByRole('img', { name: 'La etiqueta' })).toHaveAttribute('loading', 'lazy');
    await user.click(screen.getByRole('button', { name: 'Abrir imagen' }));

    const visor = await screen.findByRole('dialog', { name: `Imagen de ${CLIENTE}` });
    expect(within(visor).getByText(CLIENTE)).toBeInTheDocument();
    expect(within(visor).getByText('10:40')).toBeInTheDocument();
    expect(within(visor).getByText('La etiqueta')).toBeInTheDocument();
    expect(within(visor).getByRole('img', { name: 'La etiqueta' })).toBeInTheDocument();
  });

  it('R21: «Cerrar imagen» cierra el visor', async () => {
    const user = setupUser();
    pintar(conSrc);
    await user.click(screen.getByRole('button', { name: 'Abrir imagen' }));
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Cerrar imagen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('R21: Escape cierra el visor', async () => {
    const user = setupUser();
    pintar(conSrc);
    await user.click(screen.getByRole('button', { name: 'Abrir imagen' }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('R21: sin src muestra «[Imagen]» con el caption y no abre visor', () => {
    pintar(entrante({ kind: 'image', src: null, caption: 'La etiqueta' }));
    expect(screen.getByText('[Imagen]')).toBeInTheDocument();
    expect(screen.getByText('La etiqueta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir imagen' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('R21: sin caption el alt es «Imagen enviada por el cliente»', () => {
    pintar(entrante({ kind: 'image', src: '/media/m1', caption: null }));
    expect(screen.getByRole('img', { name: 'Imagen enviada por el cliente' })).toBeInTheDocument();
  });

  it('R21: si la imagen no carga, «Imagen no disponible» en la miniatura y en el visor', async () => {
    const user = setupUser();
    pintar(conSrc);

    fireEvent.error(screen.getByRole('img', { name: 'La etiqueta' }));
    expect(screen.getByText('Imagen no disponible')).toBeInTheDocument();
    expect(screen.getByText('La etiqueta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir imagen' }));
    const visor = await screen.findByRole('dialog');
    expect(within(visor).getByText('Imagen no disponible')).toBeInTheDocument();
    expect(within(visor).getByText('La etiqueta')).toBeInTheDocument();
    expect(within(visor).queryByRole('img')).toBeNull();
  });

  it('R21: si falla dentro del visor, también allí «Imagen no disponible»', async () => {
    const user = setupUser();
    pintar(conSrc);
    await user.click(screen.getByRole('button', { name: 'Abrir imagen' }));
    const visor = await screen.findByRole('dialog');

    fireEvent.error(within(visor).getByRole('img', { name: 'La etiqueta' }));
    expect(within(visor).getByText('Imagen no disponible')).toBeInTheDocument();
  });
});

describe('R22 · sticker', () => {
  it('R22: con src es una imagen de 128 px sin burbuja y con la hora debajo', () => {
    pintar(entrante({ kind: 'sticker', src: '/media/s1' }));
    const sticker = screen.getByRole('img', { name: 'Sticker' });
    expect(sticker).toHaveAttribute('src', '/media/s1');
    expect(sticker.className).toContain('size-32');
    expect(screen.getByTestId('chat-message').className).not.toContain('border');
    expect(screen.getByText('10:40')).toBeInTheDocument();
  });

  it('R22: sin src es el recuadro «[Sticker]» del mismo tamaño', () => {
    pintar(entrante({ kind: 'sticker', src: null }));
    expect(screen.getByText('[Sticker]').className).toContain('size-32');
  });

  it('R22: si no carga es el recuadro «Imagen no disponible» del mismo tamaño', () => {
    pintar(entrante({ kind: 'sticker', src: '/media/s1' }));
    fireEvent.error(screen.getByRole('img', { name: 'Sticker' }));
    expect(screen.getByText('Imagen no disponible').className).toContain('size-32');
  });
});

describe('R23 · ubicación', () => {
  it('R23: tarjeta con lugar, dirección y «Abrir en el mapa» en pestaña nueva con las coordenadas', () => {
    pintar(
      entrante({ kind: 'location', latitude: -0.18, longitude: -78.47, name: 'Bodega norte', address: 'Av. Amazonas 123' }),
    );
    expect(screen.getByText('Bodega norte')).toBeInTheDocument();
    expect(screen.getByText('Av. Amazonas 123')).toBeInTheDocument();

    const enlace = screen.getByRole('link', { name: /Abrir en el mapa/ });
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
    const url = new URL(enlace.getAttribute('href') ?? '');
    expect(url.searchParams.get('query')).toBe('-0.18,-78.47');
  });

  it('R23: sin lugar ni dirección queda solo el enlace', () => {
    pintar(entrante({ kind: 'location', latitude: 1, longitude: 2, name: null, address: null }));
    expect(screen.getByRole('link', { name: 'Abrir en el mapa' })).toBeInTheDocument();
  });
});

describe('R24 · reacción pegada', () => {
  it('R24: la reacción va dentro del mensaje con nombre accesible «Reacción del cliente: <emoji>»', () => {
    pintar(mensaje({ reaction: { emoji: '👍' } }));
    const reaccion = within(screen.getByTestId('chat-message')).getByRole('img', { name: 'Reacción del cliente: 👍' });
    expect(reaccion).toHaveTextContent('👍');
  });

  it('R24: sin reacción no se pinta ninguna', () => {
    pintar(mensaje());
    expect(screen.queryByRole('img', { name: /Reacción del cliente/ })).toBeNull();
  });
});

describe('R41 · Reintentar', () => {
  const fallido = mensaje({ delivery: 'failed', errorReason: 'x', retryable: true });

  it('R41: un fallido reintentable con permiso de envío muestra «Reintentar» y llama al callback con su id', async () => {
    const user = setupUser();
    const { onRetry } = pintar(fallido);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledWith('m1');
  });

  it('R41: sin permiso de envío no hay «Reintentar»', () => {
    pintar(fallido, { canSend: false });
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('R41: un fallido no reintentable (de sistema) no muestra «Reintentar»', () => {
    pintar(mensaje({ delivery: 'failed', errorReason: 'x', retryable: false, author: { kind: 'system' } }));
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
