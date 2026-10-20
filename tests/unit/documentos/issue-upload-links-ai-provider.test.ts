// La emision de enlaces con el paso del proveedor IA: el orden es permiso, conexion, esquema y
// firmas. Cada doble anota su llamada en un registro comun, asi el orden se afirma, no se supone.

import { describe, expect, it, vi } from 'vitest';

import { DOCUMENT_UPLOAD_PERMISSION, type Actor } from '@/lib/modules/documentos/domain/actor';
import {
  AiProviderMissingError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/documentos/domain/errors';
import { createIssueUploadLinks } from '@/lib/modules/documentos/domain/issue-upload-links';
import { errorMessage } from '@/lib/modules/errores';

import type { DocumentStorage, SignedUpload } from '@/lib/modules/documentos/ports/document-storage';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const PERSONA = '11111111-1111-4111-8111-111111111111';

const TANDA_VALIDA = {
  files: [{ fileName: 'formula.pdf', contentType: 'application/pdf' as const }],
};

function actor(permissions: readonly string[] = [DOCUMENT_UPLOAD_PERMISSION]): Actor {
  return { id: PERSONA, companyId: EMPRESA, permissions };
}

function montar(configured: boolean) {
  const pasos: string[] = [];
  const isConfigured = vi.fn(async (companyId: string): Promise<boolean> => {
    pasos.push(`isConfigured:${companyId}`);
    return configured;
  });
  const createSignedUpload = vi.fn(async (path: string): Promise<SignedUpload> => {
    pasos.push('createSignedUpload');
    return { path, uploadUrl: 'https://almacenamiento.invalido/s', token: 't', expiresAt: 'x' };
  });
  const noUsar = vi.fn(async () => {
    throw new Error('la emision no lee, no descarga ni borra');
  });
  const storage: DocumentStorage = {
    createSignedUpload,
    createSignedReadUrl: noUsar,
    download: noUsar,
    remove: noUsar,
  };
  const emitir = createIssueUploadLinks({ storage, aiProvider: { isConfigured } });
  return { emitir, pasos, isConfigured, createSignedUpload };
}

describe('documentos — emision de enlaces sin proveedor IA (R23)', () => {
  it('R23 — sin conexion rechaza con `ai_provider_missing` y no firma ningun enlace', async () => {
    const t = montar(false);

    const rechazo = t.emitir(actor(), TANDA_VALIDA);
    await expect(rechazo).rejects.toBeInstanceOf(AiProviderMissingError);
    await expect(rechazo).rejects.toMatchObject({
      code: 'ai_provider_missing',
      message: errorMessage('ai_provider_missing'),
    });
    expect(t.createSignedUpload).not.toHaveBeenCalled();
    expect(t.pasos).toEqual([`isConfigured:${EMPRESA}`]);
  });

  it('R23 — el permiso va ANTES: sin permiso gana `unauthorized` y la conexion no se consulta', async () => {
    const t = montar(false);

    await expect(t.emitir(actor([]), TANDA_VALIDA)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(t.emitir(null, TANDA_VALIDA)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(t.isConfigured).not.toHaveBeenCalled();
    expect(t.pasos).toEqual([]);
  });

  it('R23 — la conexion va ANTES del esquema: con entrada rota y sin conexion gana `ai_provider_missing`', async () => {
    const t = montar(false);

    await expect(t.emitir(actor(), { files: [] })).rejects.toBeInstanceOf(AiProviderMissingError);
    expect(t.createSignedUpload).not.toHaveBeenCalled();
  });

  it('R23 — con conexion, el esquema sigue rechazando y no firma', async () => {
    const t = montar(true);

    await expect(t.emitir(actor(), { files: [] })).rejects.toBeInstanceOf(ValidationError);
    expect(t.pasos).toEqual([`isConfigured:${EMPRESA}`]);
  });

  it('R23 — con conexion firma, y la conexion se consulto PRIMERO y una vez', async () => {
    const t = montar(true);

    const { uploads } = await t.emitir(actor(), TANDA_VALIDA);
    expect(uploads).toHaveLength(1);
    expect(t.pasos).toEqual([`isConfigured:${EMPRESA}`, 'createSignedUpload']);
  });
});
