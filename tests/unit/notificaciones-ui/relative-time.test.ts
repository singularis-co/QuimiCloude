import { describe, expect, it } from 'vitest';

import { formatClock, formatRelativeTime } from '@/app/(private)/components/notifications/relative-time';

const ZONE = 'America/Santo_Domingo';
const NOW = new Date('2026-10-19T15:00:00.000Z');

const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;
const D = 24 * H;

describe('formatRelativeTime', () => {
  it.each([
    [0, 'ahora'],
    [59 * S, 'ahora'],
    [60 * S, 'hace 1 min'],
    [59 * MIN, 'hace 59 min'],
    [59 * MIN + 59 * S, 'hace 59 min'],
    [60 * MIN, 'hace 1 h'],
    [23 * H + 59 * MIN, 'hace 23 h'],
    [24 * H, 'hace 1 día'],
    [2 * D + 5 * H, 'hace 2 días'],
    [7 * D, 'hace 7 días'],
  ])('R30: con %d ms de antigüedad dice «%s»', (elapsed, expected) => {
    expect(formatRelativeTime(ago(elapsed), NOW, ZONE)).toBe(expected);
  });

  it('R30: con 7 días y 1 min pasa a DD/MM/AAAA HH:MM en la zona del navegador', () => {
    // 2026-10-12T14:59Z son las 10:59 en Santo Domingo (UTC-4).
    expect(formatRelativeTime(ago(7 * D + MIN), NOW, ZONE)).toBe('12/10/2026 10:59');
  });

  it('R30: la fecha usa la zona dada: el mismo instante cambia de día en otra zona', () => {
    const instant = '2026-10-01T02:30:00.000Z';
    expect(formatRelativeTime(instant, NOW, ZONE)).toBe('30/09/2026 22:30');
    expect(formatRelativeTime(instant, NOW, 'UTC')).toBe('01/10/2026 02:30');
  });

  it('R30: una hora futura por desfase de relojes dice «ahora»', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 5 * MIN), NOW, ZONE)).toBe('ahora');
  });
});

describe('formatClock', () => {
  it('R47: HH:MM con 24 horas en la zona dada', () => {
    expect(formatClock('2026-10-19T18:52:00.000Z', ZONE)).toBe('14:52');
    expect(formatClock('2026-10-19T04:05:00.000Z', ZONE)).toBe('00:05');
  });
});
