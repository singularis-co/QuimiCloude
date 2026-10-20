import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DELETED_ORDER_MARK,
  EXECUTION_ACTION_LABELS,
  PHASE_DURATION_LABELS,
  PHASE_OPEN_MARK,
  PHASE_UNCLOSED_MARK,
  TRACE_ORDER_STATUS_LABELS,
  formatElapsed,
  formatElapsedMinutes,
  formatSnapshotDate,
  formatTraceInstant,
  formatTraceTotal,
} from '@/app/(private)/dashboard/components/execution-trace-format';

const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;
const D = 24 * H;

describe('R15 - formato de una duracion por debajo de 24 h', () => {
  it.each([
    [0, '0 s'],
    [45 * S, '45 s'],
    [12 * MIN + 30 * S, '12 min 30 s'],
    [H + 5 * MIN, '1 h 05 min'],
    [15 * H + 20 * MIN, '15 h 20 min'],
    [D - S, '23 h 59 min'],
  ])('R15 - %i ms se muestra %j', (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected);
  });
});

describe('R15 - formato de una duracion de 24 h o mas', () => {
  it('R15 - exactamente 24 h es 1 d 00 h 00 min', () => {
    expect(formatElapsed(D)).toBe('1 d 00 h 00 min');
  });

  it('R15 - dias, horas y minutos a dos cifras', () => {
    expect(formatElapsed(2 * D + 2 * H + 5 * MIN)).toBe('2 d 02 h 05 min');
  });

  it('R15 - los segundos se truncan, no se redondean', () => {
    expect(formatElapsed(2 * D + 2 * H + 5 * MIN + 59 * S)).toBe('2 d 02 h 05 min');
    expect(formatElapsed(45 * S + 999)).toBe('45 s');
  });
});

describe('R3 - R15 - la marca de cada tipo de duracion', () => {
  it('R3 - una duracion abierta se marca (en curso)', () => {
    expect(formatTraceTotal({ kind: 'open', ms: 45 * MIN })).toBe('45 min (en curso)');
  });

  it('R15 - sin anotacion de cierre se marca (sin cierre anotado)', () => {
    expect(formatTraceTotal({ kind: 'unclosed', ms: 0 })).toBe('0 min (sin cierre anotado)');
  });

  it('R15 - cerrada no lleva marca', () => {
    expect(formatTraceTotal({ kind: 'closed', ms: H + 5 * MIN })).toBe('1 h 05 min');
  });
});

describe('R13 - instantes, acciones y estados', () => {
  it('R13 - el instante se pinta en UTC como YYYY-MM-DD HH:mm:ss', () => {
    expect(formatTraceInstant(new Date('2026-10-07T23:05:09.123Z'))).toBe('2026-10-07 23:05:09');
  });

  it('R13 - las once acciones tienen su etiqueta en espanol', () => {
    expect(EXECUTION_ACTION_LABELS).toEqual({
      start: 'Arrancar',
      resume: 'Retomar',
      advance: 'Avanzar',
      go_back: 'Retroceder',
      cancel: 'Cancelar',
      finish: 'Finalizar',
      pack_start: 'Comenzar empaque',
      pack_finish: 'Terminar empaque',
      conditioning_start: 'Comenzar acondicionamiento',
      conditioning_batch_save: 'Guardado de datos de lote',
      conditioning_finish: 'Terminar acondicionamiento',
    });
  });

  it('R3 - EN_CURSO se lee «En fabricación»', () => {
    expect(TRACE_ORDER_STATUS_LABELS.EN_CURSO).toBe('En fabricación');
  });

  it('R13 - la marca de dado de baja', () => {
    expect(DELETED_ORDER_MARK).toBe('Dado de baja');
  });

  it('R15 - ningun formato depende de la configuracion regional', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(private)/dashboard/components/execution-trace-format.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/toLocale\w*String/);
    expect(source).not.toContain('Intl.');
  });
});

describe('R26 - el total de la lista en minutos enteros', () => {
  it.each([
    [0, '0 min'],
    [59 * S + 999, '0 min'],
    [28 * MIN + 12 * S, '28 min'],
    [4 * H + 33 * MIN + 59 * S, '4 h 33 min'],
    [D + 2 * H + 5 * MIN + 30 * S, '1 d 02 h 05 min'],
  ])('R26 - formatElapsedMinutes trunca %i ms a %j', (ms, expected) => {
    expect(formatElapsedMinutes(ms)).toBe(expected);
  });

  it('R26 - formatTraceTotal trunca a minutos y lleva los tres sufijos', () => {
    expect(formatTraceTotal({ kind: 'closed', ms: 5 * H + 29 * MIN + 59 * S })).toBe('5 h 29 min');
    expect(formatTraceTotal({ kind: 'open', ms: 4 * H + 33 * MIN + 12 * S })).toBe('4 h 33 min (en curso)');
    expect(formatTraceTotal({ kind: 'unclosed', ms: 3 * H + 46 * MIN + 59 * S })).toBe(
      '3 h 46 min (sin cierre anotado)',
    );
  });

  it('R26 - una duracion negativa se muestra como 0 min', () => {
    expect(formatTraceTotal({ kind: 'closed', ms: -5 * MIN })).toBe('0 min');
  });
});

describe('R15 - fechas de la foto de un guardado', () => {
  it('R15 - formatSnapshotDate reordena AAAA-MM-DD a dd/mm/aaaa', () => {
    expect(formatSnapshotDate('2027-10-14')).toBe('14/10/2027');
    expect(formatSnapshotDate('2026-01-02')).toBe('02/01/2026');
  });

  it('R15 - el primer y el ultimo dia del ano no se corren por huso horario', () => {
    expect(formatSnapshotDate('2026-01-01')).toBe('01/01/2026');
    expect(formatSnapshotDate('2026-12-31')).toBe('31/12/2026');
  });
});

describe('R25 - etiquetas de las tarjetas por fase', () => {
  it('R25 - una etiqueta por fase y las dos insignias', () => {
    expect(PHASE_DURATION_LABELS).toEqual({
      production: 'Duración de producción',
      packing: 'Duración de empaque',
      conditioning: 'Duración de acondicionamiento',
    });
    expect(PHASE_OPEN_MARK).toBe('En curso');
    expect(PHASE_UNCLOSED_MARK).toBe('Sin cierre anotado');
  });
});
