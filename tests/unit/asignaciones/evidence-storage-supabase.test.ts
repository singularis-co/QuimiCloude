// `evidenceStorageSupabase.createSignedReadUrls` contra el bucket de evidencias. Ningun caso toca la
// red: `@supabase/storage-js` se dobla con `vi.mock`, igual que el resto de adaptadores del bucket.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { evidenceStorageSupabase } from '@/lib/modules/asignaciones/adapters/driven/storage/evidence-storage-supabase';

const createSignedUrls = vi.fn();
const from = vi.fn(() => ({ createSignedUrls }));

vi.mock('@supabase/storage-js', () => ({
  StorageClient: vi.fn(function StorageClientDouble() {
    return { from };
  }),
  isStorageError: () => false,
}));

const BASE = 'https://proyecto.supabase.co/storage/v1/object/sign/evidencias';

function signed(path: string): {
  error: null;
  path: string;
  signedURL: string;
  signedUrl: string;
} {
  return { error: null, path, signedURL: `/object/sign/evidencias/${path}`, signedUrl: `${BASE}/${path}?token=t` };
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_STORAGE_URL', 'https://proyecto.supabase.co/storage/v1');
  vi.stubEnv('SUPABASE_EVIDENCE_BUCKET', 'evidencias');
  vi.stubEnv('SUPABASE_STORAGE_KEY', 'clave-secreta');
});

afterEach(() => {
  vi.unstubAllEnvs();
  createSignedUrls.mockReset();
  from.mockClear();
});

describe('evidenceStorageSupabase.createSignedReadUrls (QC-271 R10, R11)', () => {
  it('R10: firma todas las rutas en una llamada, con el plazo, contra el bucket de evidencias', async () => {
    createSignedUrls.mockResolvedValueOnce({ data: [signed('e/p/1'), signed('e/p/2')], error: null });

    await evidenceStorageSupabase.createSignedReadUrls(['e/p/1', 'e/p/2'], 900);

    expect(from).toHaveBeenCalledWith('evidencias');
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(['e/p/1', 'e/p/2'], 900);
  });

  it('R10: devuelve las URL en el orden de las rutas pedidas aunque la respuesta venga en otro', async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [signed('e/p/3'), signed('e/p/1'), signed('e/p/2')],
      error: null,
    });

    const urls = await evidenceStorageSupabase.createSignedReadUrls(['e/p/1', 'e/p/2', 'e/p/3'], 900);

    expect(urls).toEqual([`${BASE}/e/p/1?token=t`, `${BASE}/e/p/2?token=t`, `${BASE}/e/p/3?token=t`]);
  });

  it('R10: con la lista vacia devuelve una lista vacia sin llamar al bucket', async () => {
    await expect(evidenceStorageSupabase.createSignedReadUrls([], 900)).resolves.toEqual([]);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it('R11: lanza si falla la llamada entera', async () => {
    createSignedUrls.mockResolvedValueOnce({ data: null, error: new Error('bucket caido') });

    await expect(evidenceStorageSupabase.createSignedReadUrls(['e/p/1'], 900)).rejects.toThrow('bucket caido');
  });

  it('R11: lanza si falla uno solo de los elementos, nombrando su ruta', async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [signed('e/p/1'), { error: 'Either the object does not exist or you do not have access to it', path: 'e/p/2', signedURL: null, signedUrl: null }],
      error: null,
    });

    await expect(evidenceStorageSupabase.createSignedReadUrls(['e/p/1', 'e/p/2'], 900)).rejects.toThrow(
      'e/p/2',
    );
  });

  it('R11: lanza si la respuesta no trae una de las rutas pedidas', async () => {
    createSignedUrls.mockResolvedValueOnce({ data: [signed('e/p/1')], error: null });

    await expect(evidenceStorageSupabase.createSignedReadUrls(['e/p/1', 'e/p/2'], 900)).rejects.toThrow(
      'e/p/2',
    );
  });
});
