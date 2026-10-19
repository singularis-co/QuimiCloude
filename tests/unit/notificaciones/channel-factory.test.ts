// La factory de canales y el motor con canales simulados, incluido uno ficticio que hoy no existe.
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  createChannelFactory,
  createNotify,
  type CatalogEntry,
  type ChannelRegistry,
  type NotificationCatalog,
} from '@/lib/modules/notificaciones';
import type {
  ChannelKey,
  NotificationChannel,
} from '@/lib/modules/notificaciones/ports/notification-channel';
import type {
  NewNotification,
  StoredNotification,
} from '@/lib/modules/notificaciones/ports/notification-inbox';

const COMPANY = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const USER = '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40';

// Un canal que el tipo todavía no conoce: el día que exista, solo cambia la unión `ChannelKey`.
const FAKE = 'fake' as ChannelKey;

function entry(channels: readonly ChannelKey[]): CatalogEntry<{ userId: string }> {
  return {
    schema: z.object({ userId: z.string() }),
    tone: () => 'warning',
    title: () => 'Aviso de prueba',
    body: () => 'Cuerpo',
    bodyTime: () => null,
    linkLabel: () => 'Ver',
    target: () => null,
    audience: { kind: 'user', userIdFrom: (p) => p.userId },
    channels,
  };
}

function inboxThatRecords() {
  const rows: StoredNotification[] = [];
  return {
    rows,
    insertIfAbsent: vi.fn(async (n: NewNotification) => {
      const row: StoredNotification = { ...n, id: `id-${String(rows.length + 1)}`, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
  };
}

/** El registro por la clave de cada canal: con `FAKE` un literal de objeto repetiría `in_app`. */
function registryOf(channels: readonly NotificationChannel[]): ChannelRegistry {
  return Object.fromEntries(channels.map((c) => [c.key, c])) as ChannelRegistry;
}

function channel(key: ChannelKey, deliver = vi.fn(async () => undefined)) {
  return { channel: { key, deliver } satisfies NotificationChannel, deliver };
}

function engine(catalog: NotificationCatalog, registry: Parameters<typeof createChannelFactory>[0]) {
  const inbox = inboxThatRecords();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const notify = createNotify({
    catalog,
    inbox,
    addon: { isOn: async () => true },
    recipients: { belongsToCompany: async () => true },
    channels: createChannelFactory(registry),
    log,
  });
  return { notify, inbox, log };
}

const EVENT = (key: string) => ({ key, companyId: COMPANY, dedupeKey: `${key}:1`, payload: { userId: USER } });

describe('createChannelFactory', () => {
  it('R8: devuelve los canales registrados de las claves pedidas, en su orden, y omite los que no están', () => {
    const inApp = channel('in_app').channel;
    const fake = channel(FAKE).channel;
    const factory = createChannelFactory(registryOf([inApp, fake]));

    expect(factory.channelsFor([FAKE, 'in_app'])).toEqual([fake, inApp]);
    expect(createChannelFactory({ in_app: inApp }).channelsFor(['in_app', FAKE])).toEqual([inApp]);
    expect(factory.channelsFor([])).toEqual([]);
  });
});

describe('notify con varios canales', () => {
  it('R8: entrega el aviso por cada canal que el catálogo fija para su evento', async () => {
    const inApp = channel('in_app');
    const fake = channel(FAKE);
    const { notify, inbox } = engine(
      { 'pruebas.dos_canales': entry(['in_app', FAKE]) },
      registryOf([inApp.channel, fake.channel]),
    );

    await notify(EVENT('pruebas.dos_canales'));

    expect(inApp.deliver).toHaveBeenCalledWith(inbox.rows[0]);
    expect(fake.deliver).toHaveBeenCalledWith(inbox.rows[0]);
  });

  it('R10: un canal ficticio registrado recibe los eventos que el catálogo le asigna, y no los demás', async () => {
    const inApp = channel('in_app');
    const fake = channel(FAKE);
    const { notify, inbox } = engine(
      {
        'pruebas.con_ficticio': entry(['in_app', FAKE]),
        'pruebas.solo_app': entry(['in_app']),
      },
      registryOf([inApp.channel, fake.channel]),
    );

    await notify(EVENT('pruebas.con_ficticio'));
    await notify(EVENT('pruebas.solo_app'));

    expect(fake.deliver).toHaveBeenCalledTimes(1);
    expect(fake.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ id: inbox.rows[0]!.id, eventKey: 'pruebas.con_ficticio' }),
    );
    expect(inApp.deliver).toHaveBeenCalledTimes(2);
  });

  it('R11: si el ficticio lanza, los demás canales reciben el aviso y la bandeja ya estaba escrita', async () => {
    const order: string[] = [];
    const inbox = inboxThatRecords();
    inbox.insertIfAbsent.mockImplementation(async (n: NewNotification) => {
      order.push('inbox');
      const row: StoredNotification = { ...n, id: 'id-1', createdAt: new Date() };
      inbox.rows.push(row);
      return row;
    });
    const failing = channel(
      FAKE,
      vi.fn(async () => {
        order.push('fake');
        throw new Error('el canal ficticio cayo');
      }),
    );
    const inApp = channel(
      'in_app',
      vi.fn(async () => {
        order.push('in_app');
      }),
    );
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const notify = createNotify({
      catalog: { 'pruebas.falla_uno': entry([FAKE, 'in_app']) },
      inbox,
      addon: { isOn: async () => true },
      recipients: { belongsToCompany: async () => true },
      channels: createChannelFactory(registryOf([inApp.channel, failing.channel])),
      log,
    });

    await expect(notify(EVENT('pruebas.falla_uno'))).resolves.toBeUndefined();

    expect(order).toEqual(['inbox', 'fake', 'in_app']);
    expect(inbox.rows).toHaveLength(1);
    expect(inApp.deliver).toHaveBeenCalledWith(inbox.rows[0]);
    expect(log.error).toHaveBeenCalledWith(
      'notification_channel_failed',
      expect.objectContaining({ channel: FAKE, notificationId: 'id-1' }),
    );
  });
});
