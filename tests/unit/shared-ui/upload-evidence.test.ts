import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  registerEvidenceAction,
  requestEvidenceUploadAction,
} from '@/lib/modules/asignaciones/adapters/driving/step-evidence-actions';
import type { ErrorState } from '@/lib/modules/errores';
import { MAX_IMAGE_BYTES } from '@/lib/modules/recetas';

const compressImage = vi.hoisted(() => vi.fn());
vi.mock('@/components/shared/compress-image', () => ({ compressImage }));

import {
  EVIDENCE_MAX_DIMENSION,
  UPLOAD_EVIDENCE_TEXTS,
  uploadEvidence,
  type EvidenceUploadTarget,
  type RegisterEvidence,
  type RequestEvidenceUpload,
} from '@/components/shared/step-evidence/upload-evidence';

// Las Server Actions reales encajan en los tipos que recibe `uploadEvidence`.
type AssertAssignable<T extends U, U> = T;
export type RequestFits = AssertAssignable<typeof requestEvidenceUploadAction, RequestEvidenceUpload>;
export type RegisterFits = AssertAssignable<typeof registerEvidenceAction, RegisterEvidence>;

const TARGET: EvidenceUploadTarget = { orderId: 'order-1', phase: 'manufacturing', stepPosition: 2 };
const LINK = { path: 'company-1/order-1/abc', uploadUrl: 'https://storage.test/upload/abc', token: 't' };
const PHOTOS = [{ id: 'ev-1', slot: 1, url: 'https://storage.test/read/abc' }];

const log: string[] = [];

type PutBehavior = 'ok' | 'rejected' | 'network';

class FakeXhr {
  static instances: FakeXhr[] = [];
  static behavior: PutBehavior = 'ok';
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = null;
  status = 0;
  upload: {
    onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
    FakeXhr.instances.push(this);
    log.push('put');
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
      if (FakeXhr.behavior === 'network') {
        this.onerror?.();
        return;
      }
      this.status = FakeXhr.behavior === 'ok' ? 200 : 403;
      this.onload?.();
    });
  }
}

function photoFile(type = 'image/jpeg', name = 'foto.jpg'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

const compressedFile = new File([new Uint8Array([9])], 'foto.webp', { type: 'image/webp' });

function actions() {
  const requestUpload = vi.fn<RequestEvidenceUpload>(async () => {
    log.push('request');
    return { status: 'success', data: LINK };
  });
  const register = vi.fn<RegisterEvidence>(async () => {
    log.push('register');
    return { status: 'success', data: { photos: PHOTOS } };
  });
  return { requestUpload, register };
}

const LIMIT_ERROR: ErrorState = {
  status: 'error',
  code: 'evidence_limit',
  message: 'Ese paso ya tiene 3 fotos: cambia o quita una antes de subir otra.',
};

function containsBytes(value: unknown): boolean {
  if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return true;
  if (value !== null && typeof value === 'object') return Object.values(value).some(containsBytes);
  return false;
}

beforeEach(() => {
  log.length = 0;
  FakeXhr.instances = [];
  FakeXhr.behavior = 'ok';
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  compressImage.mockReset();
  compressImage.mockImplementation(async () => {
    log.push('compress');
    return { ok: true, file: compressedFile, compressed: true };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadEvidence', () => {
  it('R18 — comprime antes de subir, pide el enlace, sube y registra al final, en ese orden', async () => {
    const { requestUpload, register } = actions();

    const result = await uploadEvidence(photoFile(), TARGET, { requestUpload, register });

    expect(log).toEqual(['compress', 'request', 'put', 'register']);
    expect(result).toEqual({ status: 'success', photos: PHOTOS });
    expect(compressImage).toHaveBeenCalledWith(expect.any(File), {
      maxBytes: MAX_IMAGE_BYTES,
      maxDimension: EVIDENCE_MAX_DIMENSION,
      accept: ['image/jpeg', 'image/png', 'image/webp'],
    });
    expect(EVIDENCE_MAX_DIMENSION).toBe(1600);
    expect(requestUpload).toHaveBeenCalledWith(TARGET);
    expect(register).toHaveBeenCalledWith({ ...TARGET, path: LINK.path });
  });

  it('R18 R16 — hace PUT del archivo comprimido al enlace firmado e informa del progreso', async () => {
    const { requestUpload, register } = actions();
    const onProgress = vi.fn();

    await uploadEvidence(photoFile(), TARGET, { requestUpload, register, onProgress });

    const [xhr] = FakeXhr.instances;
    expect(xhr?.method).toBe('PUT');
    expect(xhr?.url).toBe(LINK.uploadUrl);
    expect(xhr?.body).toBe(compressedFile);
    expect(xhr?.headers['content-type']).toBe('image/webp');
    expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([0, 50, 100]);
  });

  it('R18 — nunca pasa los bytes de la foto a una Server Action', async () => {
    const { requestUpload, register } = actions();

    await uploadEvidence(photoFile(), TARGET, { requestUpload, register });

    for (const call of [...requestUpload.mock.calls, ...register.mock.calls]) {
      expect(containsBytes(call)).toBe(false);
      expect(JSON.parse(JSON.stringify(call))).toEqual(call);
    }
  });

  it('R19 — al cambiar una foto, el enlace y el registro llevan la foto sustituida', async () => {
    const { requestUpload, register } = actions();
    const change = { ...TARGET, replacesEvidenceId: 'ev-1' };

    await uploadEvidence(photoFile(), change, { requestUpload, register });

    expect(requestUpload).toHaveBeenCalledWith(change);
    expect(register).toHaveBeenCalledWith({ ...change, path: LINK.path });
  });

  it.each(['image/gif', 'application/pdf', 'image/heic', ''])(
    'R17 — un archivo de tipo «%s» queda en error sin comprimir, sin pedir enlace y sin subir',
    async (type) => {
      const { requestUpload, register } = actions();

      const result = await uploadEvidence(photoFile(type, 'x'), TARGET, { requestUpload, register });

      expect(result).toEqual({ status: 'error', stage: 'file', message: UPLOAD_EVIDENCE_TEXTS.invalidType });
      expect(log).toEqual([]);
    },
  );

  it('R17 — si tras comprimir sigue pesando más de 5 MB, queda en error sin pedir enlace ni subir', async () => {
    const { requestUpload, register } = actions();
    compressImage.mockResolvedValueOnce({ ok: false, reason: 'not_compressible' });

    const result = await uploadEvidence(photoFile('image/png', 'grande.png'), TARGET, {
      requestUpload,
      register,
    });

    expect(result).toEqual({ status: 'error', stage: 'file', message: UPLOAD_EVIDENCE_TEXTS.tooLarge });
    expect(requestUpload).not.toHaveBeenCalled();
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('R18 — si el servidor niega el enlace, no sube ni registra y devuelve su motivo', async () => {
    const { requestUpload, register } = actions();
    requestUpload.mockResolvedValueOnce(LIMIT_ERROR);

    const result = await uploadEvidence(photoFile(), TARGET, { requestUpload, register });

    expect(result).toEqual({
      status: 'error',
      stage: 'request',
      message: LIMIT_ERROR.message,
      error: LIMIT_ERROR,
    });
    expect(FakeXhr.instances).toHaveLength(0);
    expect(register).not.toHaveBeenCalled();
  });

  it('R18 — si pedir el enlace falla por la red, queda en error inesperado sin subir', async () => {
    const { requestUpload, register } = actions();
    requestUpload.mockRejectedValueOnce(new Error('offline'));

    const result = await uploadEvidence(photoFile(), TARGET, { requestUpload, register });

    expect(result).toMatchObject({ status: 'error', stage: 'request' });
    expect(FakeXhr.instances).toHaveLength(0);
    expect(register).not.toHaveBeenCalled();
  });

  it.each<PutBehavior>(['rejected', 'network'])(
    'R18 — si el PUT falla (%s), no registra la foto: no cuenta',
    async (behavior) => {
      const { requestUpload, register } = actions();
      FakeXhr.behavior = behavior;

      const result = await uploadEvidence(photoFile(), TARGET, { requestUpload, register });

      expect(result).toMatchObject({ status: 'error', stage: 'upload' });
      expect(register).not.toHaveBeenCalled();
    },
  );

  it('R18 — si el registro se rechaza, devuelve el motivo del servidor y la foto no cuenta', async () => {
    const { requestUpload, register } = actions();
    const invalid: ErrorState = {
      status: 'error',
      code: 'evidence_invalid_file',
      message: 'No se pudo registrar la foto: debe ser JPG, PNG o WebP y pesar como maximo 4.4 MB.',
    };
    register.mockResolvedValueOnce(invalid);

    const result = await uploadEvidence(photoFile(), TARGET, { requestUpload, register });

    expect(result).toEqual({ status: 'error', stage: 'register', message: invalid.message, error: invalid });
  });

  it('R18 — si el registro falla por la red, queda en error', async () => {
    const { requestUpload, register } = actions();
    register.mockRejectedValueOnce(new Error('offline'));

    const result = await uploadEvidence(photoFile(), TARGET, { requestUpload, register });

    expect(result).toMatchObject({ status: 'error', stage: 'register' });
  });
});
