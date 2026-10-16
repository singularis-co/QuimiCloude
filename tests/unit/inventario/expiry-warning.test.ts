import { describe, expect, it } from 'vitest';

import {
  daysUntil,
  EXPIRY_WARNING_DAYS,
  expiryRelativeLabel,
  isExpired,
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

describe('daysUntil: dias de calendario hasta el vencimiento', () => {
  it.each([
    ['hoy', '2026-10-15', 0],
    ['manana', '2026-10-16', 1],
    ['ayer', '2026-10-14', -1],
    ['hace 3 dias', '2026-10-12', -3],
    ['en 20 dias', '2026-11-04', 20],
  ])('%s → %i', (_caso, date, expected) => {
    expect(daysUntil(date, TODAY)).toBe(expected);
  });

  it('sin fecha o con fecha mal formada devuelve null', () => {
    expect(daysUntil(null, TODAY)).toBeNull();
    expect(daysUntil(undefined, TODAY)).toBeNull();
    expect(daysUntil('15/10/2026', TODAY)).toBeNull();
  });
});

describe('expiryRelativeLabel: texto relativo del vencimiento', () => {
  it.each([
    [0, 'vence hoy'],
    [1, 'vence en 1 día'],
    [20, 'vence en 20 días'],
    [-1, 'venció hace 1 día'],
    [-3, 'venció hace 3 días'],
  ])('%i → «%s»', (days, expected) => {
    expect(expiryRelativeLabel(days)).toBe(expected);
  });
});

describe('isExpired: el lote ya vencio', () => {
  it.each([
    [-3, true],
    [-1, true],
    [0, false],
    [1, false],
    [20, false],
    [null, false],
  ])('%s → %s', (days, expected) => {
    expect(isExpired(days)).toBe(expected);
  });
});
