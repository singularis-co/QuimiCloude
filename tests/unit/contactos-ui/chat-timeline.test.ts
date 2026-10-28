import { describe, expect, it } from 'vitest';

import {
  mergeLatestMessages,
  prependOlderMessages,
  withDaySeparators,
} from '@/app/(private)/clientes/contactos/components/chat-timeline';

type Msg = { id: string; at: string; status?: string };

const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
const msg = (id: string, at: string, status?: string): Msg => ({ id, at, status });

describe('chat-timeline', () => {
  it('R17: ordena de más antiguo a más reciente aunque lleguen desordenados', () => {
    const merged = mergeLatestMessages([msg('b', local(21, 10))], [msg('c', local(21, 11)), msg('a', local(21, 9))]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('R17: con el mismo instante respeta el orden de llegada', () => {
    const at = local(21, 10);
    expect(mergeLatestMessages([], [msg('x', at), msg('y', at)]).map((m) => m.id)).toEqual(['x', 'y']);
  });

  it('R17: pone un separador cada vez que cambia el día local', () => {
    const now = new Date(2026, 9, 21, 12);
    const entries = withDaySeparators([msg('a', local(19, 9)), msg('b', local(20, 23, 59)), msg('c', local(21, 0, 1)), msg('d', local(21, 8))], now);
    expect(entries.map((e) => (e.kind === 'day' ? `[${e.label}]` : e.message.id))).toEqual([
      '[19/10/2026]',
      'a',
      '[Ayer]',
      'b',
      '[Hoy]',
      'c',
      'd',
    ]);
    const keys = entries.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('R17: sin mensajes no hay separadores', () => {
    expect(withDaySeparators([], new Date())).toEqual([]);
  });

  it('R25: antepone los anteriores sin duplicar y se queda con la versión ya cargada', () => {
    const current = [msg('m3', local(21, 10), 'DELIVERED'), msg('m4', local(21, 11))];
    const older = [msg('m1', local(20, 9)), msg('m2', local(20, 10)), msg('m3', local(21, 10), 'SENT')];
    const merged = prependOlderMessages(current, older);
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(merged.find((m) => m.id === 'm3')?.status).toBe('DELIVERED');
  });

  it('R42: unir la página nueva del poller no repite mensajes y el estado nuevo reemplaza al viejo', () => {
    const current = [msg('m1', local(21, 9)), msg('m2', local(21, 10), 'SENT')];
    const latest = [msg('m2', local(21, 10), 'DELIVERED'), msg('m3', local(21, 11))];
    const merged = mergeLatestMessages(current, latest);
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(merged.find((m) => m.id === 'm2')?.status).toBe('DELIVERED');
  });
});
