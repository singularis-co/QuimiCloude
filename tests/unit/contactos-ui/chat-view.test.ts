import { describe, expect, it } from 'vitest';

import {
  targetKey,
  toChatContext,
  toChatMessages,
} from '@/app/(private)/clientes/contactos/components/chat-view';
import type {
  WhatsappChatContext,
  WhatsappChatMessage,
  WhatsappCustomerOrder,
} from '@/lib/modules/integraciones';

function message(overrides: Partial<WhatsappChatMessage> & { id: string }): WhatsappChatMessage {
  return {
    direction: 'IN',
    type: 'TEXT',
    body: 'Hola',
    attachment: null,
    status: 'RECEIVED',
    errorReason: null,
    origin: null,
    sentBy: null,
    templateName: null,
    at: '2026-10-24T10:00:00.000Z',
    ...overrides,
  };
}

function outbound(overrides: Partial<WhatsappChatMessage> & { id: string }): WhatsappChatMessage {
  return message({ direction: 'OUT', status: 'SENT', origin: 'USER', sentBy: { id: 'u1', displayName: 'Ana' }, ...overrides });
}

function reaction(id: string, messageId: string | null, emoji: string | null, at: string): WhatsappChatMessage {
  return message({ id, type: 'REACTION', body: null, attachment: { kind: 'reaction', emoji, messageId }, at });
}

function media(mediaUrl: string | null, caption: string | null = null): WhatsappChatMessage['attachment'] {
  return { kind: 'media', mimeType: 'image/jpeg', filename: null, caption, mediaUrl };
}

describe('toChatMessages', () => {
  it('R19: traduce cada estado de un saliente a su entrega, y un entrante no lleva estado ni autor', () => {
    const views = toChatMessages([
      outbound({ id: 'q', status: 'QUEUED' }),
      outbound({ id: 's', status: 'SENDING' }),
      outbound({ id: 'st', status: 'SENT' }),
      outbound({ id: 'd', status: 'DELIVERED' }),
      outbound({ id: 'r', status: 'READ' }),
      outbound({ id: 'f', status: 'FAILED', errorReason: 'Número no válido' }),
      message({ id: 'in' }),
    ]);
    expect(views.map((view) => [view.id, view.side, view.delivery])).toEqual([
      ['q', 'out', 'sending'],
      ['s', 'out', 'sending'],
      ['st', 'out', 'sent'],
      ['d', 'out', 'delivered'],
      ['r', 'out', 'read'],
      ['f', 'out', 'failed'],
      ['in', 'in', null],
    ]);
    expect(views[5]?.errorReason).toBe('Número no válido');
    expect(views[6]?.author).toBeNull();
  });

  it('R18: el autor de un saliente es el usuario que lo envió o el sistema', () => {
    const [user, unnamed, system] = toChatMessages([
      outbound({ id: 'a' }),
      outbound({ id: 'b', sentBy: { id: 'u2', displayName: null } }),
      outbound({ id: 'c', origin: 'SYSTEM', sentBy: null }),
    ]);
    expect(user?.author).toEqual({ kind: 'user', name: 'Ana' });
    expect(unnamed?.author).toEqual({ kind: 'user', name: null });
    expect(system?.author).toEqual({ kind: 'system' });
  });

  it('R20: texto, plantilla, botón e interactivo con cuerpo se pintan como texto; sin cuerpo, no soportado', () => {
    const views = toChatMessages([
      message({ id: 't', type: 'TEXT', body: 'Hola' }),
      outbound({ id: 'tpl', type: 'TEMPLATE', body: 'Su pedido está listo' }),
      message({ id: 'b', type: 'BUTTON', body: 'Sí' }),
      message({ id: 'i', type: 'INTERACTIVE', body: 'Opción 2' }),
      message({ id: 'i2', type: 'INTERACTIVE', body: null }),
      message({ id: 't2', type: 'TEXT', body: '   ' }),
    ]);
    expect(views.map((view) => view.content)).toEqual([
      { kind: 'text', text: 'Hola' },
      { kind: 'text', text: 'Su pedido está listo' },
      { kind: 'text', text: 'Sí' },
      { kind: 'text', text: 'Opción 2' },
      { kind: 'unsupported' },
      { kind: 'unsupported' },
    ]);
  });

  it('R20: audio, video y documento van como etiqueta con su caption; contactos y no soportado, como no soportado', () => {
    const views = toChatMessages([
      message({ id: 'a', type: 'AUDIO', body: null, attachment: media(null) }),
      message({ id: 'v', type: 'VIDEO', body: null, attachment: media(null, 'Mira esto') }),
      message({ id: 'd', type: 'DOCUMENT', body: null, attachment: media(null, 'Factura') }),
      message({ id: 'c', type: 'CONTACTS', body: null }),
      message({ id: 'u', type: 'UNSUPPORTED', body: null }),
    ]);
    expect(views.map((view) => view.content)).toEqual([
      { kind: 'label', label: '[Audio]', caption: null },
      { kind: 'label', label: '[Video]', caption: 'Mira esto' },
      { kind: 'label', label: '[Documento]', caption: 'Factura' },
      { kind: 'unsupported' },
      { kind: 'unsupported' },
    ]);
  });

  it('R20: una ubicación lleva coordenadas, lugar y dirección; sin adjunto, no soportado', () => {
    const [location, broken] = toChatMessages([
      message({
        id: 'l',
        type: 'LOCATION',
        body: null,
        attachment: { kind: 'location', latitude: -0.18, longitude: -78.47, name: 'Bodega', address: 'Av. 10' },
      }),
      message({ id: 'l2', type: 'LOCATION', body: null }),
    ]);
    expect(location?.content).toEqual({ kind: 'location', latitude: -0.18, longitude: -78.47, name: 'Bodega', address: 'Av. 10' });
    expect(broken?.content).toEqual({ kind: 'unsupported' });
  });

  it('R21/R22: la imagen y el sticker toman src de attachment.mediaUrl; null si no lo trae', () => {
    const views = toChatMessages([
      message({ id: 'img', type: 'IMAGE', body: null, attachment: media('/api/integraciones/whatsapp/media/img', 'Etiqueta') }),
      message({ id: 'img2', type: 'IMAGE', body: null, attachment: media(null, 'Sin archivo') }),
      message({ id: 'stk', type: 'STICKER', body: null, attachment: media('/api/integraciones/whatsapp/media/stk') }),
      message({ id: 'stk2', type: 'STICKER', body: null, attachment: media(null) }),
    ]);
    expect(views.map((view) => view.content)).toEqual([
      { kind: 'image', src: '/api/integraciones/whatsapp/media/img', caption: 'Etiqueta' },
      { kind: 'image', src: null, caption: 'Sin archivo' },
      { kind: 'sticker', src: '/api/integraciones/whatsapp/media/stk' },
      { kind: 'sticker', src: null },
    ]);
  });

  it('R21/R22: audio, video y documento nunca dan una fuente aunque el adjunto traiga mediaUrl', () => {
    const views = toChatMessages([
      message({ id: 'a', type: 'AUDIO', body: null, attachment: media('/x/a') }),
      message({ id: 'v', type: 'VIDEO', body: null, attachment: media('/x/v') }),
      message({ id: 'd', type: 'DOCUMENT', body: null, attachment: media('/x/d') }),
    ]);
    for (const view of views) {
      expect(view.content.kind).toBe('label');
      expect(view.content).not.toHaveProperty('src');
    }
  });

  it('R24: la reacción no sale como mensaje y se pega al mensaje cuyo id es su messageId', () => {
    const views = toChatMessages([message({ id: 'm1' }), reaction('r1', 'm1', '👍', '2026-10-24T10:01:00.000Z')]);
    expect(views.map((view) => view.id)).toEqual(['m1']);
    expect(views[0]?.reaction).toEqual({ emoji: '👍' });
  });

  it('R24: una reacción con messageId null no se pinta en ningún mensaje', () => {
    const views = toChatMessages([message({ id: 'm1' }), reaction('r1', null, '👍', '2026-10-24T10:01:00.000Z')]);
    expect(views).toHaveLength(1);
    expect(views[0]?.reaction).toBeNull();
  });

  it('R24: si el objetivo no está cargado no pinta nada, y aparece al llegar con los anteriores', () => {
    const r = reaction('r1', 'old', '❤️', '2026-10-24T10:05:00.000Z');
    const before = toChatMessages([message({ id: 'm1' }), r]);
    expect(before.map((view) => view.reaction)).toEqual([null]);

    const after = toChatMessages([message({ id: 'old', at: '2026-10-23T09:00:00.000Z' }), message({ id: 'm1' }), r]);
    expect(after.find((view) => view.id === 'old')?.reaction).toEqual({ emoji: '❤️' });
  });

  it('R24: con varias reacciones gana la más reciente, y si esa trae emoji nulo no se muestra ninguna', () => {
    const latestWins = toChatMessages([
      message({ id: 'm1' }),
      reaction('r2', 'm1', '😂', '2026-10-24T10:03:00.000Z'),
      reaction('r1', 'm1', '👍', '2026-10-24T10:01:00.000Z'),
    ]);
    expect(latestWins[0]?.reaction).toEqual({ emoji: '😂' });

    const removed = toChatMessages([
      message({ id: 'm1' }),
      reaction('r1', 'm1', '👍', '2026-10-24T10:01:00.000Z'),
      reaction('r2', 'm1', null, '2026-10-24T10:02:00.000Z'),
    ]);
    expect(removed[0]?.reaction).toBeNull();
  });

  it('R41: solo un saliente fallido de origen usuario es reintentable', () => {
    const views = toChatMessages([
      outbound({ id: 'user-failed', status: 'FAILED' }),
      outbound({ id: 'system-failed', status: 'FAILED', origin: 'SYSTEM', sentBy: null }),
      outbound({ id: 'user-sent', status: 'SENT' }),
      message({ id: 'in' }),
    ]);
    expect(views.map((view) => [view.id, view.retryable])).toEqual([
      ['user-failed', true],
      ['system-failed', false],
      ['user-sent', false],
      ['in', false],
    ]);
  });
});

function order(overrides: Partial<WhatsappCustomerOrder> & { id: string }): WhatsappCustomerOrder {
  return {
    number: '2026-0000128',
    status: 'POR_EMPACAR',
    requestedAt: '2026-10-20T15:00:00.000Z',
    total: null,
    productName: 'Cloro 10 %',
    lines: [{ presentationId: 'p1', presentationName: 'Bidón 20 L', ordered: 10, delivered: 6, pending: 4 }],
    ...overrides,
  };
}

function context(orders: readonly WhatsappCustomerOrder[], values: WhatsappChatContext['values'] = {}): WhatsappChatContext {
  return { customer: { id: 'c1', name: 'Laura Gómez' }, orders, selectedOrderId: orders[0]?.id ?? null, values };
}

describe('toChatContext', () => {
  it('R38: sin pedidos abiertos no hay pedidos ni pedido elegido', () => {
    expect(toChatContext(context([]))).toEqual({ orders: [], selectedOrderId: null, values: {} });
  });

  it('R39: un pedido sale con número, estado de Pedidos, producto y una fila por línea', () => {
    const view = toChatContext(context([order({ id: 'o1' })]));
    expect(view.orders).toEqual([
      {
        id: 'o1',
        number: '2026-0000128',
        statusLabel: 'Por empacar',
        productName: 'Cloro 10 %',
        totalLabel: null,
        lines: [{ key: '0:p1', ordered: '10 × Bidón 20 L', delivered: 6, pending: 4 }],
      },
    ]);
    expect(view.selectedOrderId).toBe('o1');
  });

  it('R38: con dos pedidos conserva el orden recibido y el pedido elegido', () => {
    const ctx = { ...context([order({ id: 'new', number: '2026-0000130' }), order({ id: 'old', number: '2026-0000101', status: 'BLOQUEADO' })]), selectedOrderId: 'old' };
    const view = toChatContext(ctx);
    expect(view.orders.map((o) => [o.id, o.number, o.statusLabel])).toEqual([
      ['new', '2026-0000130', 'Por empacar'],
      ['old', '2026-0000101', 'Bloqueado'],
    ]);
    expect(view.selectedOrderId).toBe('old');
  });

  it('R39: el total null da totalLabel null y un total con valor pasa tal cual', () => {
    const [withoutTotal, withTotal] = toChatContext(context([order({ id: 'a' }), order({ id: 'b', total: '412.50' })])).orders;
    expect(withoutTotal?.totalLabel).toBeNull();
    expect(withTotal?.totalLabel).toBe('412.50');
  });

  it('R39: una presentación sin nombre sale «N × —» y el detalle no trae fecha de entrega ni de solicitud', () => {
    const [view] = toChatContext(
      context([order({ id: 'o1', productName: null, lines: [{ presentationId: 'p9', presentationName: null, ordered: 3, delivered: 0, pending: 3 }] })]),
    ).orders;
    expect(view?.lines[0]?.ordered).toBe('3 × —');
    expect(view?.productName).toBeNull();
    expect(Object.keys(view ?? {})).toEqual(['id', 'number', 'statusLabel', 'productName', 'totalLabel', 'lines']);
  });

  it('R38/R39: values pasa sin tocar', () => {
    const values = { 'cliente.nombre': 'Laura Gómez', 'pedido.total': null, saludo: 'Hola' };
    expect(toChatContext(context([order({ id: 'o1' })], values)).values).toEqual(values);
  });
});

describe('targetKey', () => {
  it('R54: distingue el chat por contacto del chat por cliente', () => {
    expect(targetKey({ contactId: 'x' })).toBe('contact:x');
    expect(targetKey({ customerId: 'x' })).toBe('customer:x');
  });
});
