// El motor de avisos con todos sus puertos simulados: sin base, sin composición.
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  createChannelFactory,
  createNotify,
  type CatalogEntry,
  type NotificationCatalog,
  type NotifyDeps,
} from '@/lib/modules/notificaciones';
import type { NotificationChannel } from '@/lib/modules/notificaciones/ports/notification-channel';
import type {
  NewNotification,
  StoredNotification,
} from '@/lib/modules/notificaciones/ports/notification-inbox';

const COMPANY = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const USER = '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40';

const userEntry: CatalogEntry<{ recipientUserId: string; total: number }> = {
  schema: z.object({ recipientUserId: z.string(), total: z.number().int() }),
  tone: () => 'success',
  title: () => 'Tanda de PDFs procesada',
  body: (p) => `Se leyeron los ${String(p.total)} archivos.`,
  bodyTime: () => null,
  linkLabel: () => 'Ver fórmulas',
  target: () => ({ kind: 'formulas' }),
  audience: { kind: 'user', userIdFrom: (p) => p.recipientUserId },
  channels: ['in_app'],
};

const CATALOG: NotificationCatalog = { 'pruebas.tanda_lista': userEntry };

function event(overrides: Partial<{ key: string; payload: unknown; dedupeKey: string }> = {}) {
  return {
    key: 'pruebas.tanda_lista',
    companyId: COMPANY,
    dedupeKey: 'pruebas.tanda_lista:1',
    payload: { recipientUserId: USER, total: 3 },
    ...overrides,
  };
}

function setup(overrides: Partial<NotifyDeps> = {}) {
  const stored = new Map<string, StoredNotification>();
  const insertIfAbsent = vi.fn(async (n: NewNotification) => {
    const key = `${n.companyId}|${n.dedupeKey}`;
    if (stored.has(key)) return null;
    const row: StoredNotification = { ...n, id: `id-${String(stored.size + 1)}`, createdAt: new Date() };
    stored.set(key, row);
    return row;
  });
  const deliver = vi.fn(async () => undefined);
  const channel: NotificationChannel = { key: 'in_app', deliver };
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const isActive = vi.fn(async () => true);
  const belongsToCompany = vi.fn(async () => true);
  const deps: NotifyDeps = {
    catalog: CATALOG,
    inbox: { insertIfAbsent },
    companies: { isActive },
    recipients: { belongsToCompany },
    channels: createChannelFactory({ in_app: channel }),
    log,
    ...overrides,
  };
  return { notify: createNotify(deps), insertIfAbsent, deliver, log, isActive, belongsToCompany, stored };
}

describe('notify — el motor de avisos', () => {
  it('R2: un evento del catálogo crea un único aviso dirigido al usuario que fija el catálogo', async () => {
    const { notify, insertIfAbsent, deliver } = setup();

    await notify(event());

    expect(insertIfAbsent).toHaveBeenCalledTimes(1);
    expect(insertIfAbsent.mock.calls[0]![0]).toEqual({
      companyId: COMPANY,
      eventKey: 'pruebas.tanda_lista',
      tone: 'success',
      title: 'Tanda de PDFs procesada',
      body: 'Se leyeron los 3 archivos.',
      bodyTime: null,
      linkLabel: 'Ver fórmulas',
      target: { kind: 'formulas' },
      recipient: { kind: 'user', userId: USER },
      dedupeKey: 'pruebas.tanda_lista:1',
    });
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('R3: el mismo evento con la misma clave deja un solo aviso y no se vuelve a entregar', async () => {
    const { notify, deliver, stored } = setup();

    await notify(event());
    await notify(event());

    expect(stored.size).toBe(1);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('R4: un evento que no está en el catálogo no crea aviso, queda en el log y no lanza', async () => {
    const { notify, insertIfAbsent, log } = setup();

    await expect(notify(event({ key: 'pruebas.desconocido' }))).resolves.toBeUndefined();

    expect(insertIfAbsent).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'notification_rejected',
      expect.objectContaining({ reason: 'unknown_event', eventKey: 'pruebas.desconocido' }),
    );
  });

  it('R4: una clave heredada de Object (toString) tampoco cuenta como evento del catálogo', async () => {
    const { notify, insertIfAbsent, log } = setup();

    await expect(notify(event({ key: 'toString' }))).resolves.toBeUndefined();

    expect(insertIfAbsent).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'notification_rejected',
      expect.objectContaining({ reason: 'unknown_event' }),
    );
  });

  it('R4: un payload sin la forma del catálogo no crea aviso, queda en el log y no lanza', async () => {
    const { notify, insertIfAbsent, isActive, log } = setup();

    await expect(
      notify(event({ payload: { recipientUserId: USER, total: 'tres' } })),
    ).resolves.toBeUndefined();

    expect(insertIfAbsent).not.toHaveBeenCalled();
    expect(isActive).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'notification_rejected',
      expect.objectContaining({ reason: 'invalid_payload' }),
    );
  });

  it('R7: si la bandeja lanza, notify no lanza y el fallo queda en el log', async () => {
    const { notify, deliver, log } = setup({
      inbox: {
        insertIfAbsent: vi.fn(async () => {
          throw new Error('conexion caida con datos sensibles');
        }),
      },
    });

    await expect(notify(event())).resolves.toBeUndefined();

    expect(deliver).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(
      'notification_failed',
      expect.objectContaining({ eventKey: 'pruebas.tanda_lista', error: 'Error' }),
    );
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('datos sensibles');
  });

  it('R57: si la consulta de la empresa lanza, notify no lanza', async () => {
    const { notify, insertIfAbsent, deliver, log } = setup({
      companies: { isActive: vi.fn(async () => Promise.reject(new Error('sin base'))) },
    });

    await expect(notify(event())).resolves.toBeUndefined();

    expect(insertIfAbsent).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(
      'notification_failed',
      expect.objectContaining({ eventKey: 'pruebas.tanda_lista', companyId: COMPANY, error: 'Error' }),
    );
  });

  it('R12: un destinatario que no es de la empresa del evento se rechaza y queda en el log', async () => {
    const belongsToCompany = vi.fn(async () => false);
    const { notify, insertIfAbsent, log } = setup({ recipients: { belongsToCompany } });

    await notify(event());

    expect(belongsToCompany).toHaveBeenCalledWith(USER, COMPANY);
    expect(insertIfAbsent).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'notification_rejected',
      expect.objectContaining({ reason: 'recipient_outside_company' }),
    );
  });

  it('R55: con el directorio en false no se crea el aviso y queda en el log', async () => {
    // El directorio responde `false` para un usuario dado de baja: lo prueba la integración del
    // adaptador. Aquí basta con que el motor trate ese `false` como «no es de la empresa».
    const belongsToCompany = vi.fn(async () => false);
    const { notify, insertIfAbsent, deliver, log } = setup({ recipients: { belongsToCompany } });

    await expect(notify(event())).resolves.toBeUndefined();

    expect(insertIfAbsent).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'notification_rejected',
      expect.objectContaining({ eventKey: 'pruebas.tanda_lista', companyId: COMPANY, reason: 'recipient_outside_company' }),
    );
  });

  it('R19: crea el aviso sin consultar ningún añadido', async () => {
    const { notify, insertIfAbsent, deliver, isActive } = setup();

    await notify(event());

    // `NotifyDeps` ya no tiene puerto de añadido: lo único que se pregunta de la empresa es si vive.
    expect(isActive).toHaveBeenCalledWith(COMPANY);
    expect(insertIfAbsent).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('R57: con la empresa dada de baja no escribe la bandeja, no entrega por ningún canal y registra el descarte', async () => {
    const isActive = vi.fn(async () => false);
    const { notify, insertIfAbsent, deliver, belongsToCompany, log } = setup({ companies: { isActive } });

    await expect(notify(event())).resolves.toBeUndefined();

    expect(isActive).toHaveBeenCalledWith(COMPANY);
    expect(belongsToCompany).not.toHaveBeenCalled();
    expect(insertIfAbsent).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith('notification_company_inactive', {
      eventKey: 'pruebas.tanda_lista',
      companyId: COMPANY,
    });
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });
});
