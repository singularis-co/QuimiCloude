import { describe, expect, it } from 'vitest';

import {
  EXPIRY_WARNING_DAYS,
  isExpiringSoon,
} from '@/app/(private)/inventario/components/expiry-warning';

const TODAY = '2026-10-15';

describe('isExpiringSoon: vencimiento a menos de 30 dias de calendario', () => {
  it('el umbral es de 30 dias', () => {
    expect(EXPIRY_WARNING_DAYS).toBe(30);
  });

  it.each([
    ['vence hoy', '2026-10-15', true],
    ['vence en 29 dias', '2026-11-13', true],
    ['vence en 30 dias', '2026-11-14', false],
    ['vence en 31 dias', '2026-11-15', false],
    ['ya vencido', '2026-10-01', true],
    ['vencido hace un ano', '2025-10-15', true],
  ])('%s -> %s', (_caso, date, expected) => {
    expect(isExpiringSoon(date, TODAY)).toBe(expected);
  });

  it('sin fecha no avisa', () => {
    expect(isExpiringSoon(null, TODAY)).toBe(false);
    expect(isExpiringSoon(undefined, TODAY)).toBe(false);
  });

  it('cuenta dias de calendario aunque el mes cambie de horario de verano', () => {
    expect(isExpiringSoon('2026-04-03', '2026-03-05')).toBe(true);
    expect(isExpiringSoon('2026-04-04', '2026-03-05')).toBe(false);
  });

  it('una fecha mal formada no avisa', () => {
    expect(isExpiringSoon('15/10/2026', TODAY)).toBe(false);
  });
});
