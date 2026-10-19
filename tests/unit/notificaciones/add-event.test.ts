// Agregar un evento es añadir una entrada al catálogo: el motor y la factory no cambian.
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  createChannelFactory,
  createNotify,
  NOTIFICATION_CATALOG,
  type CatalogEntry,
  type NotificationCatalog,
} from '@/lib/modules/notificaciones';
import type {
  NewNotification,
  StoredNotification,
} from '@/lib/modules/notificaciones/ports/notification-inbox';

const COMPANY = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

const stockLow: CatalogEntry<{ product: string; uploadedAt: Date }> = {
  schema: z.object({ product: z.string().min(1), uploadedAt: z.date() }),
  tone: () => 'danger',
  title: () => 'Existencias bajo la alerta',
  body: (p) => `Quedan pocas unidades de ${p.product} desde las {hora}.`,
  bodyTime: (p) => p.uploadedAt,
  linkLabel: () => 'Ver proveedores',
  target: () => ({ kind: 'suppliers' }),
  audience: { kind: 'role', role: 'Administrador' },
  channels: ['in_app'],
};

function engine(catalog: NotificationCatalog) {
  const rows: StoredNotification[] = [];
  const insertIfAbsent = vi.fn(async (n: NewNotification) => {
    const row: StoredNotification = { ...n, id: 'id-1', createdAt: new Date() };
    rows.push(row);
    return row;
  });
  const deliver = vi.fn(async () => undefined);
  const belongsToCompany = vi.fn(async () => true);
  const notify = createNotify({
    catalog,
    inbox: { insertIfAbsent },
    addon: { isOn: async () => true },
    recipients: { belongsToCompany },
    channels: createChannelFactory({ in_app: { key: 'in_app', deliver } }),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { notify, rows, deliver, belongsToCompany };
}

describe('agregar un evento al catálogo', () => {
  it('R6: un evento nuevo en el catálogo crea su aviso con el mismo motor y la misma factory', async () => {
    const uploadedAt = new Date('2026-10-19T09:12:00.000Z');
    const { notify, rows, deliver } = engine({ ...NOTIFICATION_CATALOG, 'inventario.stock_bajo': stockLow });

    await notify({
      key: 'inventario.stock_bajo',
      companyId: COMPANY,
      dedupeKey: 'inventario.stock_bajo:p1',
      payload: { product: 'Soda', uploadedAt },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventKey: 'inventario.stock_bajo',
      tone: 'danger',
      title: 'Existencias bajo la alerta',
      body: 'Quedan pocas unidades de Soda desde las {hora}.',
      bodyTime: uploadedAt,
      linkLabel: 'Ver proveedores',
      target: { kind: 'suppliers' },
    });
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('R1: un evento con destinatario por rol se guarda con el rol, sin usuario y sin consultar el directorio', async () => {
    const { notify, rows, belongsToCompany } = engine({ 'inventario.stock_bajo': stockLow });

    await notify({
      key: 'inventario.stock_bajo',
      companyId: COMPANY,
      dedupeKey: 'inventario.stock_bajo:p2',
      payload: { product: 'Soda', uploadedAt: new Date() },
    });

    expect(rows[0]!.recipient).toEqual({ kind: 'role', role: 'Administrador' });
    expect(belongsToCompany).not.toHaveBeenCalled();
  });
});
