// @vitest-environment jsdom
// El registro de tandas recordadas en el almacenamiento del navegador. Cada caso importa el
// modulo de cero tras `vi.resetModules()`: es lo mas parecido a recargar la pagina.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BatchMemory = typeof import('@/components/shared/document-upload/batch-memory');

const CLAVE_GLOBAL = 'document-upload-remembered-batches';
const AMBITO = 'u1:c1';
const CLAVE = `${CLAVE_GLOBAL}:${AMBITO}`;

const tanda = (batchId: string, rememberedAt = 1_000) => ({
  batchId,
  strategy: 'formula' as const,
  rememberedAt,
});

async function recargar(): Promise<BatchMemory> {
  vi.resetModules();
  return import('@/components/shared/document-upload/batch-memory');
}

function guardado(clave: string): unknown {
  const crudo = window.localStorage.getItem(clave);
  return crudo === null ? null : JSON.parse(crudo);
}

function idsGuardados(clave: string): string[] {
  const valor = guardado(clave);
  if (!Array.isArray(valor)) return [];
  return valor.map((entrada: { batchId: string }) => entrada.batchId);
}

function clavesGuardadas(): string[] {
  const claves: string[] = [];
  for (let indice = 0; indice < window.localStorage.length; indice++) {
    const clave = window.localStorage.key(indice);
    if (clave !== null) claves.push(clave);
  }
  return claves;
}

function avisarDesdeOtraPestana(clave: string, valor: string | null): void {
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: clave,
      newValue: valor,
      storageArea: window.localStorage,
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('batch-memory: lectura robusta', () => {
  it('R19 muestra tras la recarga las tandas guardadas antes para el mismo ámbito', async () => {
    window.localStorage.setItem(CLAVE, JSON.stringify([tanda('b2', 2_000), tanda('b1')]));

    const memoria = await recargar();

    expect(memoria.rememberedBatches(AMBITO)).toEqual([tanda('b2', 2_000), tanda('b1')]);
  });

  it('R19 lo registrado antes de recargar sigue ahí después de recargar', async () => {
    const antes = await recargar();
    antes.rememberBatch(AMBITO, 'b1', 'formula');

    const despues = await recargar();

    expect(despues.rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual(['b1']);
  });

  it('R20 arranca vacío y sin lanzar con un JSON corrupto', async () => {
    window.localStorage.setItem(CLAVE, '{esto no es json');

    const memoria = await recargar();

    expect(() => memoria.rememberedBatches(AMBITO)).not.toThrow();
    expect(memoria.rememberedBatches(AMBITO)).toEqual([]);
  });

  it('R20 arranca vacío y sin lanzar con un valor que no es una lista', async () => {
    window.localStorage.setItem(CLAVE, JSON.stringify({ batchId: 'b1' }));

    const memoria = await recargar();

    expect(() => memoria.rememberedBatches(AMBITO)).not.toThrow();
    expect(memoria.rememberedBatches(AMBITO)).toEqual([]);
  });

  it('R21 conserva solo las entradas válidas de una forma antigua o inválida', async () => {
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify([
        tanda('valida-1'),
        { strategy: 'formula', rememberedAt: 1 },
        { batchId: '', strategy: 'formula', rememberedAt: 1 },
        { batchId: 'estrategia-rara', strategy: 'otra', rememberedAt: 1 },
        { batchId: 'instante-texto', strategy: 'formula', rememberedAt: 'ayer' },
        'b-suelto',
        null,
        tanda('valida-2'),
      ]),
    );

    const memoria = await recargar();

    expect(memoria.rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual([
      'valida-1',
      'valida-2',
    ]);
  });

  it('R23 arranca vacío y sin lanzar si el navegador rechaza la lectura', async () => {
    window.localStorage.setItem(CLAVE, JSON.stringify([tanda('b1')]));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const memoria = await recargar();

    expect(() => memoria.rememberedBatches(AMBITO)).not.toThrow();
    expect(memoria.rememberedBatches(AMBITO)).toEqual([]);
  });
});

describe('batch-memory: escritura robusta', () => {
  it('R22 conserva el registro en memoria sin lanzar si se rechaza la escritura', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const memoria = await recargar();

    expect(() => memoria.rememberBatch(AMBITO, 'b1', 'formula')).not.toThrow();
    expect(() => memoria.rememberBatch(AMBITO, 'b2', 'formula')).not.toThrow();

    expect(memoria.rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual(['b2', 'b1']);
    expect(window.localStorage.getItem(CLAVE)).toBeNull();

    expect(() => memoria.forgetBatch(AMBITO, 'b2')).not.toThrow();
    expect(memoria.rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual(['b1']);
  });
});

describe('batch-memory: ámbito usuario + empresa', () => {
  it('R26 lo registrado en u1:c1 no aparece en u1:c2 ni en u2:c1', async () => {
    const memoria = await recargar();

    memoria.rememberBatch(AMBITO, 'b1', 'formula');

    expect(memoria.rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual(['b1']);
    expect(memoria.rememberedBatches('u1:c2')).toEqual([]);
    expect(memoria.rememberedBatches('u2:c1')).toEqual([]);

    const recargada = await recargar();
    expect(recargada.rememberedBatches('u1:c2')).toEqual([]);
    expect(recargada.rememberedBatches('u2:c1')).toEqual([]);
  });

  it('R27 guarda en la clave con userId y companyId en claro y solo las tres claves', async () => {
    const memoria = await recargar();

    memoria.rememberBatch(AMBITO, 'b1', 'formula');

    expect(clavesGuardadas()).toEqual([
      'document-upload-remembered-batches:u1:c1',
    ]);
    const valor = guardado('document-upload-remembered-batches:u1:c1');
    expect(Array.isArray(valor)).toBe(true);
    for (const entrada of valor as Record<string, unknown>[]) {
      expect(Object.keys(entrada).sort()).toEqual(['batchId', 'rememberedAt', 'strategy']);
    }
  });

  it('R29 borra la clave global antigua y no muestra sus tandas', async () => {
    window.localStorage.setItem(CLAVE_GLOBAL, JSON.stringify([tanda('vieja')]));

    const memoria = await recargar();

    expect(memoria.rememberedBatches(AMBITO)).toEqual([]);
    expect(window.localStorage.getItem(CLAVE_GLOBAL)).toBeNull();
  });
});

describe('batch-memory: sincronía entre pestañas', () => {
  it('R30 el evento storage de la clave del ámbito avisa y actualiza el registro', async () => {
    const memoria = await recargar();
    const oyente = vi.fn();
    const quitar = memoria.onRememberedBatchesChange(AMBITO, oyente);
    expect(memoria.rememberedBatches(AMBITO)).toEqual([]);

    const valor = JSON.stringify([tanda('de-otra-pestana')]);
    window.localStorage.setItem(CLAVE, valor);
    avisarDesdeOtraPestana(CLAVE, valor);

    expect(oyente).toHaveBeenCalled();
    expect(memoria.rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual(['de-otra-pestana']);
    quitar();
  });

  it('R30 ignora el evento storage de la clave de otro ámbito', async () => {
    const memoria = await recargar();
    const oyente = vi.fn();
    const quitar = memoria.onRememberedBatchesChange(AMBITO, oyente);
    memoria.rememberedBatches(AMBITO);

    const otraClave = `${CLAVE_GLOBAL}:u2:c1`;
    const valor = JSON.stringify([tanda('ajena')]);
    window.localStorage.setItem(otraClave, valor);
    avisarDesdeOtraPestana(otraClave, valor);

    expect(oyente).not.toHaveBeenCalled();
    expect(memoria.rememberedBatches(AMBITO)).toEqual([]);
    quitar();
  });

  it('R30 un único listener de storage mientras haya oyentes, quitado con el último', async () => {
    const memoria = await recargar();
    const alta = vi.spyOn(window, 'addEventListener');
    const baja = vi.spyOn(window, 'removeEventListener');
    const deStorage = (espia: typeof alta) =>
      espia.mock.calls.filter(([tipo]) => tipo === 'storage').length;

    const quitarA = memoria.onRememberedBatchesChange(AMBITO, vi.fn());
    const quitarB = memoria.onRememberedBatchesChange('u2:c1', vi.fn());
    expect(deStorage(alta)).toBe(1);

    quitarA();
    expect(deStorage(baja)).toBe(0);
    quitarB();
    expect(deStorage(baja)).toBe(1);
  });

  it('R31 registrar y descartar conserva lo que otra pestaña escribió tras hidratar', async () => {
    const memoria = await recargar();
    expect(memoria.rememberedBatches(AMBITO)).toEqual([]);

    window.localStorage.setItem(CLAVE, JSON.stringify([tanda('X')]));

    memoria.rememberBatch(AMBITO, 'Y', 'formula');
    expect(idsGuardados(CLAVE)).toEqual(['Y', 'X']);
    expect(memoria.rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual(['Y', 'X']);

    memoria.forgetBatch(AMBITO, 'Y');
    expect(idsGuardados(CLAVE)).toEqual(['X']);
    expect(memoria.rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual(['X']);
  });
});

describe('batch-memory: foto estable', () => {
  it('devuelve la misma referencia entre lecturas y una nueva solo al cambiar', async () => {
    const memoria = await recargar();

    const primera = memoria.rememberedBatches(AMBITO);
    expect(memoria.rememberedBatches(AMBITO)).toBe(primera);

    memoria.rememberBatch(AMBITO, 'b1', 'formula');
    const segunda = memoria.rememberedBatches(AMBITO);
    expect(segunda).not.toBe(primera);
    expect(memoria.rememberedBatches(AMBITO)).toBe(segunda);

    memoria.forgetBatch(AMBITO, 'no-esta');
    expect(memoria.rememberedBatches(AMBITO)).toBe(segunda);
  });
});
