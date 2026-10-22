import { describe, expect, it } from 'vitest';

import {
  READ_ONLY_NOTICE,
  attemptLabel,
  batchLabel,
  batchesSummary,
  discardBatchLabel,
  resumeBatchLabel,
} from '@/components/shared/document-upload/labels';
import type { DocumentFileStatus } from '@/lib/modules/documentos';

import { batch, entry } from './helpers';

/**
 * Las fechas se construyen en hora local: «hoy», «ayer» y la hora salen del día civil del
 * navegador, así que el test no depende de la zona horaria de quien lo corre.
 */
const AHORA = new Date(2026, 9, 21, 18, 0).getTime();
const HOY_1432 = new Date(2026, 9, 21, 14, 32).getTime();
const HOY_1047 = new Date(2026, 9, 21, 10, 47).getTime();
const AYER_1432 = new Date(2026, 9, 20, 14, 32).getTime();
const DIA_15_0912 = new Date(2026, 9, 15, 9, 12).getTime();
const OTRO_ANO_0912 = new Date(2025, 9, 15, 9, 12).getTime();

function tanda(...estados: DocumentFileStatus[]) {
  return {
    status: batch(estados.map((status, index) => entry({ id: `f-${index}`, status }))),
    missing: false,
  };
}

const DESCONOCIDA = { status: null, missing: true };

describe('el texto «Intento N de M»', () => {
  it('R32 — con 0 intentos consumidos dice «Intento 1 de 4»', () => {
    expect(attemptLabel(0, 4)).toBe('Intento 1 de 4');
  });

  it('R32 — con 2 intentos consumidos dice «Intento 2 de 4»', () => {
    expect(attemptLabel(2, 4)).toBe('Intento 2 de 4');
  });

  it('R32 — si los intentos superan el tope, N se queda en el tope: «Intento 4 de 4»', () => {
    expect(attemptLabel(5, 4)).toBe('Intento 4 de 4');
  });
});

describe('el rótulo de cada tanda', () => {
  it('R33 — una tanda registrada hoy dice «Tanda de hoy, 14:32»', () => {
    expect(batchLabel(HOY_1432, null, AHORA)).toBe('Tanda de hoy, 14:32');
  });

  it('R33 — una tanda registrada ayer dice «Tanda de ayer, 14:32»', () => {
    expect(batchLabel(AYER_1432, null, AHORA)).toBe('Tanda de ayer, 14:32');
  });

  it('R33 — «ayer» es el día civil anterior aunque cambie el año', () => {
    const nochevieja = new Date(2025, 11, 31, 23, 50).getTime();
    const anoNuevo = new Date(2026, 0, 1, 0, 10).getTime();

    expect(batchLabel(nochevieja, null, anoNuevo)).toBe('Tanda de ayer, 23:50');
  });

  it('R33 — una tanda de antes, en el año actual, lleva la fecha corta sin año', () => {
    expect(batchLabel(DIA_15_0912, null, AHORA)).toBe('Tanda del 15/10, 09:12');
  });

  it('R33 — una tanda de otro año lleva la fecha corta con el año', () => {
    expect(batchLabel(OTRO_ANO_0912, null, AHORA)).toBe('Tanda del 15/10/2025, 09:12');
  });

  it('R33 — con el número de archivos conocido, el rótulo lo añade', () => {
    expect(batchLabel(HOY_1432, 3, AHORA)).toBe('Tanda de hoy, 14:32 · 3 archivos');
  });

  it('R33 — sin el número de archivos, el rótulo no lo menciona', () => {
    expect(batchLabel(HOY_1432, null, AHORA)).not.toContain('archivo');
  });
});

describe('los nombres accesibles de los controles de cada tanda', () => {
  it('R34 — «Descartar» nombra su tanda: «Descartar la tanda de hoy, 14:32»', () => {
    expect(discardBatchLabel(HOY_1432, AHORA)).toBe('Descartar la tanda de hoy, 14:32');
  });

  it('R34 — «Descartar» usa el día del rótulo también para ayer y la fecha corta', () => {
    expect(discardBatchLabel(AYER_1432, AHORA)).toBe('Descartar la tanda de ayer, 14:32');
    expect(discardBatchLabel(DIA_15_0912, AHORA)).toBe('Descartar la tanda del 15/10, 09:12');
  });

  it('R40 — «Reanudar» nombra su tanda: «Reanudar la tanda de hoy, 10:47»', () => {
    expect(resumeBatchLabel(HOY_1047, AHORA)).toBe('Reanudar la tanda de hoy, 10:47');
  });
});

describe('el resumen de la cabecera del panel', () => {
  it('R41 — una tanda sin terminar da «1 en curso»', () => {
    expect(batchesSummary([tanda('processing', 'done')])).toBe('1 en curso');
  });

  it('R41 — con todas las tandas terminadas y sin errores da «Todas terminadas»', () => {
    expect(batchesSummary([tanda('done'), tanda('done', 'done')])).toBe('Todas terminadas');
  });

  it('R41 — una tanda terminada con un archivo en error da «1 con errores»', () => {
    expect(batchesSummary([tanda('done', 'error'), tanda('done')])).toBe('1 con errores');
  });

  it('R41 — una en curso y otra con errores dan «1 en curso · 1 con errores»', () => {
    expect(batchesSummary([tanda('queued'), tanda('error')])).toBe(
      '1 en curso · 1 con errores',
    );
  });

  it('R41 — una sola tanda en curso con un archivo en error cuenta en las dos partes', () => {
    expect(batchesSummary([tanda('processing', 'error')])).toBe('1 en curso · 1 con errores');
  });

  it('R41 — una tanda desconocida sola da «Todas terminadas»', () => {
    expect(batchesSummary([DESCONOCIDA])).toBe('Todas terminadas');
  });

  it('R41 — una tanda desconocida no suma en «en curso» ni en «con errores»', () => {
    expect(batchesSummary([DESCONOCIDA, tanda('queued'), tanda('error')])).toBe(
      '1 en curso · 1 con errores',
    );
  });

  it('R41 — una tanda sin estado todavía no consta como terminada: cuenta «en curso»', () => {
    expect(batchesSummary([{ status: null, missing: false }])).toBe('1 en curso');
  });

  it('R41 — los recuentos suman cada tanda que cumple', () => {
    expect(batchesSummary([tanda('queued'), tanda('processing', 'error'), tanda('error')])).toBe(
      '2 en curso · 2 con errores',
    );
  });
});

describe('el aviso de solo lectura', () => {
  it('R35 — el aviso con la subida deshabilitada tiene el texto exacto', () => {
    expect(READ_ONLY_NOTICE).toBe(
      'La subida de PDFs está desactivada. Las tandas que ya enviaste siguen procesándose: ' +
        'puedes revisarlas y descartarlas.',
    );
  });
});
