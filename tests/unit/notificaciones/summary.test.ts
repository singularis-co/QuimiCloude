// El resumen que el navegador consulta cada 30 s: conteo y aviso más reciente, sin lista.
import { describe, expect, it, vi } from 'vitest';

import { createGetNotificationSummary } from '@/lib/modules/notificaciones';

const READER = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  companyId: '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13',
  roleName: null,
};

describe('resumen de la bandeja', () => {
  it('R22: trae el conteo de no leídos y el más reciente, y no trae lista', async () => {
    const newest = { id: '9a1d4e77-2c3b-4f58-8e06-1b7a9d3c5e02', createdAt: new Date('2026-10-19T09:12:00Z') };
    const summary = vi.fn(async () => ({ unreadCount: 3, newest }));
    const listBatch = vi.fn();
    const get = createGetNotificationSummary({
      inbox: { summary, listBatch } as unknown as Parameters<typeof createGetNotificationSummary>[0]['inbox'],
      now: () => new Date('2026-10-19T12:00:00Z'),
    });

    const result = await get(READER);

    expect(result).toEqual({ unreadCount: 3, newest });
    expect(Object.keys(result).sort()).toEqual(['newest', 'unreadCount']);
    expect(listBatch).not.toHaveBeenCalled();
  });

  it('R22: sin avisos, el conteo es 0 y no hay más reciente', async () => {
    const get = createGetNotificationSummary({
      inbox: { summary: async () => ({ unreadCount: 0, newest: null }) },
      now: () => new Date(),
    });

    expect(await get(READER)).toEqual({ unreadCount: 0, newest: null });
  });
});
