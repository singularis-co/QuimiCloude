import { describe, expect, it } from 'vitest';

import {
  formatDaySeparator,
  formatListTime,
  formatMessageTime,
  formatWindowStatus,
  windowRemaining,
} from '@/app/(private)/clientes/contactos/components/chat-time-format';

// Fechas locales: el formato es en la hora del navegador, así que el test no depende de la zona.
const local = (month: number, day: number, hour = 0, minute = 0) => new Date(2026, month - 1, day, hour, minute);
const NOW = local(10, 21, 12, 0); // miércoles

describe('formatListTime', () => {
  it('R10: de hoy sale HH:mm en hora local', () => {
    expect(formatListTime(local(10, 21, 9, 5).toISOString(), NOW)).toBe('09:05');
    expect(formatListTime(local(10, 21, 0, 0).toISOString(), NOW)).toBe('00:00');
  });

  it('R10: de ayer sale «Ayer», también si fue hace pocos minutos pasada la medianoche', () => {
    expect(formatListTime(local(10, 20, 23, 59).toISOString(), NOW)).toBe('Ayer');
    expect(formatListTime(local(10, 20, 23, 55), local(10, 21, 0, 5))).toBe('Ayer');
  });

  it('R10: de los últimos siete días sale el día abreviado', () => {
    expect(formatListTime(local(10, 19, 8).toISOString(), NOW)).toBe('Lun');
    expect(formatListTime(local(10, 18, 8).toISOString(), NOW)).toBe('Dom');
    expect(formatListTime(local(10, 15, 8).toISOString(), NOW)).toBe('Jue');
  });

  it('R10: de hace siete días o más sale dd/MM', () => {
    expect(formatListTime(local(10, 14, 8).toISOString(), NOW)).toBe('14/10');
    expect(formatListTime(local(3, 2, 8).toISOString(), NOW)).toBe('02/03');
  });
});

describe('formatMessageTime y formatDaySeparator', () => {
  it('R17: la hora del mensaje es HH:mm', () => {
    expect(formatMessageTime(local(10, 1, 7, 3).toISOString())).toBe('07:03');
    expect(formatMessageTime(local(10, 1, 23, 45))).toBe('23:45');
  });

  it('R17: el separador dice «Hoy», «Ayer» o dd/MM/yyyy', () => {
    expect(formatDaySeparator(local(10, 21, 8).toISOString(), NOW)).toBe('Hoy');
    expect(formatDaySeparator(local(10, 20, 8).toISOString(), NOW)).toBe('Ayer');
    expect(formatDaySeparator(local(10, 19, 8).toISOString(), NOW)).toBe('19/10/2026');
    expect(formatDaySeparator(new Date(2025, 11, 31, 8).toISOString(), NOW)).toBe('31/12/2025');
  });
});

describe('formatWindowStatus', () => {
  const openUntil = (date: Date) => ({ open: true as const, closesAt: date.toISOString() });

  it('R15: abierta con horas dice «se cierra en H h M min»', () => {
    expect(formatWindowStatus(openUntil(local(10, 22, 2, 30)), NOW)).toBe('Ventana abierta · se cierra en 14 h 30 min');
    expect(formatWindowStatus(openUntil(local(10, 21, 13, 0)), NOW)).toBe('Ventana abierta · se cierra en 1 h 0 min');
  });

  it('R15: abierta con menos de una hora dice solo los minutos, sin llegar nunca a 0', () => {
    expect(formatWindowStatus(openUntil(local(10, 21, 12, 45)), NOW)).toBe('Ventana abierta · se cierra en 45 min');
    expect(formatWindowStatus(openUntil(new Date(NOW.getTime() + 20_000)), NOW)).toBe('Ventana abierta · se cierra en 1 min');
  });

  it('R15: cerrada, o abierta con closesAt ya pasado, dice «Ventana cerrada»', () => {
    expect(formatWindowStatus({ open: false, closesAt: null }, NOW)).toBe('Ventana cerrada');
    expect(formatWindowStatus(openUntil(NOW), NOW)).toBe('Ventana cerrada');
    expect(windowRemaining(openUntil(local(10, 21, 11, 0)), NOW)).toBeNull();
  });
});
