// El cursor opaco de los lotes: conserva los microsegundos y rechaza lo mal formado sin leer la bandeja.
import { describe, expect, it, vi } from 'vitest';

import {
  createListNotifications,
  decodeNotificationCursor,
  encodeNotificationCursor,
  NOTIFICATIONS_READ_PERMISSION,
  ValidationError,
} from '@/lib/modules/notificaciones';
import type { NotificationInbox } from '@/lib/modules/notificaciones/ports/notification-inbox';

const CURSOR = { t: '2026-10-19T09:12:30.123456Z', i: '9a1d4e77-2c3b-4f58-8e06-1b7a9d3c5e02' };

const READER = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  companyId: '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13',
  roleName: 'Operador',
  permissions: [NOTIFICATIONS_READ_PERMISSION],
};

function encodeRaw(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function setup() {
  const listBatch = vi.fn<NotificationInbox['listBatch']>(async () => ({ items: [], next: CURSOR }));
  const list = createListNotifications({ inbox: { listBatch }, now: () => new Date() });
  return { list, listBatch };
}

describe('cursor de los lotes', () => {
  it('R28: codificar y decodificar conserva el instante con microsegundos y el id', () => {
    const encoded = encodeNotificationCursor(CURSOR);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeNotificationCursor(encoded)).toEqual(CURSOR);
  });

  it('R28: el lote pasa a la bandeja el cursor decodificado y devuelve el siguiente codificado', async () => {
    const { list, listBatch } = setup();

    const batch = await list(READER, { cursor: encodeNotificationCursor(CURSOR) });

    expect(listBatch.mock.calls[0]![1]).toEqual(CURSOR);
    expect(batch.nextCursor).toBe(encodeNotificationCursor(CURSOR));
  });

  it.each([
    ['texto que no es base64 de un JSON', 'no-es-un-cursor'],
    ['t sin microsegundos', encodeRaw({ t: '2026-10-19T09:12:30.123Z', i: CURSOR.i })],
    ['t sin forma de instante', encodeRaw({ t: 'ayer', i: CURSOR.i })],
    ['i que no es uuid', encodeRaw({ t: CURSOR.t, i: '42' })],
    ['un campo de más', encodeRaw({ ...CURSOR, companyId: READER.companyId })],
    ['un JSON que no es objeto', encodeRaw([CURSOR.t, CURSOR.i])],
  ])('R28: un cursor mal formado (%s) se rechaza sin llamar a la bandeja', async (_case, cursor) => {
    const { list, listBatch } = setup();

    expect(() => decodeNotificationCursor(cursor)).toThrow(ValidationError);
    await expect(list(READER, { cursor })).rejects.toBeInstanceOf(ValidationError);
    expect(listBatch).not.toHaveBeenCalled();
  });

  it.each([
    ['vacío', { cursor: '' }],
    ['un número', { cursor: 5 }],
    ['sin cursor', {}],
    ['no es objeto', 'cursor'],
  ])('R25: una entrada de lote inválida (%s) se rechaza sin llamar a la bandeja', async (_case, input) => {
    const { list, listBatch } = setup();

    await expect(list(READER, input)).rejects.toBeInstanceOf(ValidationError);
    expect(listBatch).not.toHaveBeenCalled();
  });
});
