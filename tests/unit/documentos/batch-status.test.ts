// Las CLAVES de los tipos del estado de una tanda, congeladas igual que el contrato congela sus
// exportaciones: quien consume `BatchStatus` pinta «intento 2 de 4» con `attempts` y `maxAttempts`,
// y una clave que cambie en silencio rompe esa pantalla sin que este archivo diga nada.

import { describe, expect, it } from 'vitest';

import type {
  BatchStatus,
  DocumentFileStatusEntry,
  ReadBatch,
} from '@/lib/modules/documentos/domain/batch-status';

const CLAVES_DE_ARCHIVO = [
  'id',
  'path',
  'attempts',
  'name',
  'status',
  'extractedText',
  'errorCode',
  'errorReason',
] as const;

const CLAVES_DE_LECTURA = ['id', 'companyId', 'strategy', 'files'] as const;

const CLAVES_DE_TANDA = [...CLAVES_DE_LECTURA, 'maxAttempts'] as const;

const ARCHIVO: DocumentFileStatusEntry = {
  id: 'archivo-1',
  path: 'empresa-1/informe.pdf',
  attempts: 2,
  name: 'informe.pdf',
  status: 'processing',
  extractedText: null,
  errorCode: null,
  errorReason: null,
};

const LECTURA: ReadBatch = {
  id: 'tanda-1',
  companyId: 'empresa-1',
  strategy: 'catalogo',
  files: [ARCHIVO],
};

const TANDA: BatchStatus = { ...LECTURA, maxAttempts: 4 };

describe('documentos — las claves del estado de una tanda, congeladas', () => {
  it('R1 — DocumentFileStatusEntry lleva exactamente las claves previstas', () => {
    expect(Object.keys(ARCHIVO).sort()).toEqual([...CLAVES_DE_ARCHIVO].sort());
  });

  it('R2 — ReadBatch y BatchStatus llevan exactamente las claves previstas', () => {
    expect(Object.keys(LECTURA).sort()).toEqual([...CLAVES_DE_LECTURA].sort());
    expect(Object.keys(TANDA).sort()).toEqual([...CLAVES_DE_TANDA].sort());
  });

  it('R1, R2 — la regla MUERDE: una clave de mas o de menos da lista distinta', () => {
    expect(Object.keys({ ...TANDA, sorpresa: 1 }).sort()).not.toEqual([...CLAVES_DE_TANDA].sort());
    expect(Object.keys(ARCHIVO).filter((clave) => clave !== 'name').sort()).not.toEqual([
      ...CLAVES_DE_ARCHIVO,
    ].sort());
  });
});