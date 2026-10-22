// tests/unit/asignaciones/step-evidence-actions.test.ts
//
// Las tres Server Actions de las fotos de evidencia. Esta capa no decide nada: se prueba la accion
// REAL contra la composicion doblada. Lo que se mira es la traduccion de errores, que la sesion se
// lee una vez y que las advertencias del bucket van al log y no al navegador.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  registerEvidenceAction,
  removeEvidenceAction,
  requestEvidenceUploadAction,
} from '@/lib/modules/asignaciones/adapters/driving/step-evidence-actions';
import {
  EvidenceInvalidFileError,
  EvidenceLimitError,
  EvidenceNotFoundError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones';

const {
  getSessionUserMock,
  getSessionContextMock,
  requestEvidenceUploadMock,
  registerEvidenceMock,
  removeEvidenceMock,
  logWarnMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  requestEvidenceUploadMock: vi.fn(),
  registerEvidenceMock: vi.fn(),
  removeEvidenceMock: vi.fn(),
  logWarnMock: vi.fn(),
}));

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: vi.fn(async () => 'req-1') },
  identity: {
    getSessionUser: getSessionUserMock,
    getSessionContext: getSessionContextMock,
  },
  asignaciones: {
    requestEvidenceUpload: requestEvidenceUploadMock,
    registerEvidence: registerEvidenceMock,
    removeEvidence: removeEvidenceMock,
  },
}));

vi.mock('@/lib/shared/observability/logger', () => ({
  forModule: () => ({ info: vi.fn(), warn: logWarnMock, error: vi.fn() }),
}));

const SESSION_USER = {
  id: 'user-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Operador',
  permissions: ['asignaciones.ejecutar'],
};
const SESSION_CONTEXT = { userId: 'user-1', companyId: 'company-1', roleName: 'Operador' };
const ACTOR = { id: 'user-1', companyId: 'company-1', permissions: ['asignaciones.ejecutar'] };

const ORDER_ID = '3f1c9b2e-8d47-4a10-9c65-2b7e4f0a1d38';
const EVIDENCE_ID = '9a1d4e77-2c3b-4f58-8e06-1b7a9d3c5e02';
const PATH = `company-1/${ORDER_ID}/5b6f3d21-9c4e-4a7f-8b03-6d2e1f5a9c44`;
const PHOTOS = [{ id: EVIDENCE_ID, slot: 1, url: 'https://evidencias-e2e.invalid/1' }];

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(SESSION_USER);
  getSessionContextMock.mockResolvedValue(SESSION_CONTEXT);
});

describe('requestEvidenceUploadAction', () => {
  const input = { orderId: ORDER_ID, phase: 'manufacturing' as const, stepPosition: 1 };

  it('devuelve el enlace firmado y entrega el actor de la sesion al caso de uso (R18)', async () => {
    requestEvidenceUploadMock.mockResolvedValue({ path: PATH, uploadUrl: 'https://up', token: 't' });

    const resultado = await requestEvidenceUploadAction(input);

    expect(resultado).toEqual({ status: 'success', data: { path: PATH, uploadUrl: 'https://up', token: 't' } });
    expect(requestEvidenceUploadMock).toHaveBeenCalledWith(ACTOR, input);
  });

  it('lee la sesion una sola vez por invocacion', async () => {
    requestEvidenceUploadMock.mockResolvedValue({ path: PATH, uploadUrl: 'https://up', token: 't' });

    await requestEvidenceUploadAction(input);

    expect(getSessionUserMock).toHaveBeenCalledTimes(1);
    expect(getSessionContextMock).toHaveBeenCalledTimes(1);
  });

  it('sin sesion el caso de uso recibe actor null y su rechazo se traduce (R26)', async () => {
    getSessionUserMock.mockResolvedValue(null);
    requestEvidenceUploadMock.mockRejectedValue(new UnauthorizedError());

    const resultado = await requestEvidenceUploadAction(input);

    expect(requestEvidenceUploadMock).toHaveBeenCalledWith(null, input);
    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
  });

  it('un pedido ajeno o que ya no esta en curso sale como order_not_found (R26, R27)', async () => {
    requestEvidenceUploadMock.mockRejectedValue(new OrderNotFoundError());

    const resultado = await requestEvidenceUploadAction({ ...input, phase: 'packing' });

    expect(resultado).toMatchObject({ status: 'error', code: 'order_not_found' });
  });

  it('el tope de tres fotos sale como evidence_limit', async () => {
    requestEvidenceUploadMock.mockRejectedValue(new EvidenceLimitError());

    expect(await requestEvidenceUploadAction(input)).toMatchObject({ status: 'error', code: 'evidence_limit' });
  });

  it('un error ajeno al modulo sale como unexpected con referencia, sin su texto', async () => {
    requestEvidenceUploadMock.mockRejectedValue(new Error('bucket caido: secreto'));

    const resultado = await requestEvidenceUploadAction(input);

    expect(resultado).toMatchObject({ status: 'error', code: 'unexpected', reference: 'req-1' });
    expect(JSON.stringify(resultado)).not.toContain('secreto');
  });
});

describe('registerEvidenceAction', () => {
  const input = { orderId: ORDER_ID, phase: 'manufacturing' as const, stepPosition: 1, path: PATH };

  it('la foto cuenta cuando el servidor la registra: devuelve las fotos del paso (R18)', async () => {
    registerEvidenceMock.mockResolvedValue({ photos: PHOTOS, warnings: [] });

    const resultado = await registerEvidenceAction(input);

    expect(resultado).toEqual({ status: 'success', data: { photos: PHOTOS } });
    expect(registerEvidenceMock).toHaveBeenCalledWith(ACTOR, input);
    expect(logWarnMock).not.toHaveBeenCalled();
    expect(getSessionUserMock).toHaveBeenCalledTimes(1);
  });

  it('un borrado del bucket que falla va al log y no convierte el registro en error', async () => {
    registerEvidenceMock.mockResolvedValue({
      photos: PHOTOS,
      warnings: [{ operation: 'remove', path: PATH, message: 'timeout' }],
    });

    const resultado = await registerEvidenceAction({ ...input, replacesEvidenceId: EVIDENCE_ID });

    expect(resultado).toEqual({ status: 'success', data: { photos: PHOTOS } });
    expect(logWarnMock).toHaveBeenCalledWith('evidence_storage_cleanup_failed', {
      operation: 'remove',
      path: PATH,
      message: 'timeout',
    });
  });

  it('un archivo invalido sale como evidence_invalid_file', async () => {
    registerEvidenceMock.mockRejectedValue(new EvidenceInvalidFileError());

    expect(await registerEvidenceAction(input)).toMatchObject({ status: 'error', code: 'evidence_invalid_file' });
  });

  it('una ruta ajena sale como invalid_input', async () => {
    registerEvidenceMock.mockRejectedValue(new ValidationError());

    expect(await registerEvidenceAction(input)).toMatchObject({ status: 'error', code: 'invalid_input' });
  });

  it('sin permiso de envasado se traduce el rechazo del caso de uso (R27)', async () => {
    registerEvidenceMock.mockRejectedValue(new UnauthorizedError());

    expect(await registerEvidenceAction({ ...input, phase: 'packing' })).toMatchObject({
      status: 'error',
      code: 'unauthorized',
    });
  });
});

describe('removeEvidenceAction', () => {
  const input = { orderId: ORDER_ID, phase: 'packing' as const, evidenceId: EVIDENCE_ID };

  it('devuelve las fotos que le quedan al paso, sin las advertencias', async () => {
    removeEvidenceMock.mockResolvedValue({
      stepPosition: 2,
      photos: [],
      warnings: [{ operation: 'remove', path: PATH, message: 'timeout' }],
    });

    const resultado = await removeEvidenceAction(input);

    expect(resultado).toEqual({ status: 'success', data: { photos: [] } });
    expect(removeEvidenceMock).toHaveBeenCalledWith(ACTOR, input);
    expect(logWarnMock).toHaveBeenCalledTimes(1);
    expect(getSessionUserMock).toHaveBeenCalledTimes(1);
  });

  it('una foto que ya no existe sale como evidence_not_found', async () => {
    removeEvidenceMock.mockRejectedValue(new EvidenceNotFoundError());

    expect(await removeEvidenceAction(input)).toMatchObject({ status: 'error', code: 'evidence_not_found' });
  });

  it('quien no empaca el pedido recibe order_not_found (R27)', async () => {
    removeEvidenceMock.mockRejectedValue(new OrderNotFoundError());

    expect(await removeEvidenceAction(input)).toMatchObject({ status: 'error', code: 'order_not_found' });
  });
});
