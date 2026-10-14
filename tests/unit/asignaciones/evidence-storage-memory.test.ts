// El doble en memoria del bucket de evidencias: solo responde a rutas que firmo (la instancia del E2E
// lee ademas rutas bien formadas sembradas por otro proceso), su descarga pasa
// la validacion por contenido de las imagenes y sus URL no salen a ningun servidor real. Tambien
// el lector de la variable que lo enciende y el de la configuracion del bucket real.
import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { evidenceE2EDoublesEnabled } from '@/lib/modules/asignaciones/adapters/driven/config/evidence-e2e-doubles-env';
import { readEvidenceStorageConfigFromEnv } from '@/lib/modules/asignaciones/adapters/driven/config/evidence-storage-config-env';
import {
  evidenceStorageMemory,
  evidenceStorageMemoryForE2E,
} from '@/lib/modules/asignaciones/adapters/driven/storage/evidence-storage-memory';
import { EVIDENCE_READ_LINK_TTL_SECONDS, buildEvidencePath } from '@/lib/modules/asignaciones';
import { validateRecipeImage } from '@/lib/modules/recetas';

const ORIGIN = 'https://evidencias-e2e.invalid';

function newPath(): string {
  return buildEvidencePath(randomUUID(), randomUUID());
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('evidenceStorageMemory (R30, R33)', () => {
  it('R30: firma la subida de la ruta pedida, contra el origen que no resuelve', async () => {
    const path = newPath();
    const upload = await evidenceStorageMemory.createSignedUpload(path);
    expect(upload.path).toBe(path);
    expect(upload.uploadUrl).toBe(`${ORIGIN}/upload/${path}`);
    expect(upload.token.length).toBeGreaterThan(0);
  });

  it('R30: rechaza leer, descargar o borrar una ruta que no firmo', async () => {
    const path = newPath();
    await expect(evidenceStorageMemory.createSignedReadUrl(path, EVIDENCE_READ_LINK_TTL_SECONDS)).rejects.toThrow(path);
    await expect(evidenceStorageMemory.download(path)).rejects.toThrow(path);
    await expect(evidenceStorageMemory.remove(path)).rejects.toThrow(path);
  });

  it('R33: firma la lectura de una ruta firmada, con su plazo y sin salir del origen de pruebas', async () => {
    const path = newPath();
    await evidenceStorageMemory.createSignedUpload(path);
    const url = await evidenceStorageMemory.createSignedReadUrl(path, EVIDENCE_READ_LINK_TTL_SECONDS);
    expect(url.startsWith(`${ORIGIN}/read/${path}`)).toBe(true);
    expect(url).toContain('900');
  });

  it('R32: la descarga es un PNG que validateRecipeImage acepta', async () => {
    const path = newPath();
    await evidenceStorageMemory.createSignedUpload(path);
    const bytes = await evidenceStorageMemory.download(path);
    expect(bytes).not.toBeNull();
    expect(validateRecipeImage(bytes ?? new Uint8Array())).toEqual({
      ok: true,
      contentType: 'image/png',
      extension: 'png',
    });
  });

  it('R32: cada descarga es una copia: tocarla no cambia la siguiente', async () => {
    const path = newPath();
    await evidenceStorageMemory.createSignedUpload(path);
    const first = await evidenceStorageMemory.download(path);
    first?.fill(0);
    const second = await evidenceStorageMemory.download(path);
    expect(validateRecipeImage(second ?? new Uint8Array()).ok).toBe(true);
  });

  it('R30: borrar olvida la ruta: despues ya no se puede leer ni borrar otra vez', async () => {
    const path = newPath();
    await evidenceStorageMemory.createSignedUpload(path);
    await evidenceStorageMemory.remove(path);
    await expect(evidenceStorageMemory.download(path)).rejects.toThrow(path);
    await expect(evidenceStorageMemory.remove(path)).rejects.toThrow(path);
  });
});

describe('evidenceStorageMemory.createSignedReadUrls (QC-271 R10)', () => {
  it('R10: firma varias rutas en el orden pedido, con su plazo', async () => {
    const paths = [newPath(), newPath(), newPath()];
    for (const path of paths) await evidenceStorageMemory.createSignedUpload(path);

    const urls = await evidenceStorageMemory.createSignedReadUrls(
      [paths[2]!, paths[0]!, paths[1]!],
      EVIDENCE_READ_LINK_TTL_SECONDS,
    );

    expect(urls).toEqual(
      [paths[2]!, paths[0]!, paths[1]!].map((path) => `${ORIGIN}/read/${path}?expiresIn=900`),
    );
  });

  it('R10: con la lista vacia devuelve una lista vacia', async () => {
    await expect(evidenceStorageMemory.createSignedReadUrls([], EVIDENCE_READ_LINK_TTL_SECONDS)).resolves.toEqual([]);
  });

  it('R11: rechaza el lote entero si una de las rutas no la firmo', async () => {
    const signed = newPath();
    const unknown = newPath();
    await evidenceStorageMemory.createSignedUpload(signed);

    await expect(
      evidenceStorageMemory.createSignedReadUrls([signed, unknown], EVIDENCE_READ_LINK_TTL_SECONDS),
    ).rejects.toThrow(unknown);
  });
});

describe('evidenceStorageMemoryForE2E: rutas sembradas por otro proceso (QC-271 R27)', () => {
  it('R27: firma la lectura de una ruta bien formada que no paso por createSignedUpload', async () => {
    const path = newPath();
    await expect(evidenceStorageMemoryForE2E.createSignedReadUrl(path, EVIDENCE_READ_LINK_TTL_SECONDS)).resolves.toBe(
      `${ORIGIN}/read/${path}?expiresIn=900`,
    );
    await expect(
      evidenceStorageMemoryForE2E.createSignedReadUrls([path, newPath()], EVIDENCE_READ_LINK_TTL_SECONDS),
    ).resolves.toHaveLength(2);
  });

  it('R27: rechaza firmar la lectura de una ruta mal formada', async () => {
    const company = randomUUID();
    const order = randomUUID();
    const malformed = [
      `${company}/${order}`,
      `${company}/${order}/`,
      `${company}/${order}/${randomUUID()}/extra`,
      `no-es-uuid/${order}/${randomUUID()}`,
      `${company}/no-es-uuid/${randomUUID()}`,
      `${company}/${order}/..`,
      `../${order}/${randomUUID()}`,
    ];
    for (const path of malformed) {
      await expect(
        evidenceStorageMemoryForE2E.createSignedReadUrl(path, EVIDENCE_READ_LINK_TTL_SECONDS),
      ).rejects.toThrow(path);
    }
  });

  it('R27: descargar o borrar una ruta bien formada sin firmar sigue rechazandose', async () => {
    const path = newPath();
    await expect(evidenceStorageMemoryForE2E.download(path)).rejects.toThrow(path);
    await expect(evidenceStorageMemoryForE2E.remove(path)).rejects.toThrow(path);
  });

  it('R27: la instancia por defecto no firma rutas bien formadas que no firmo', async () => {
    const path = newPath();
    await expect(evidenceStorageMemory.createSignedReadUrl(path, EVIDENCE_READ_LINK_TTL_SECONDS)).rejects.toThrow(path);
  });
});

describe('evidenceE2EDoublesEnabled', () => {
  it('ausente, vacia o solo espacios: el bucket real', () => {
    vi.stubEnv('EVIDENCE_E2E_DOUBLES', undefined);
    expect(evidenceE2EDoublesEnabled()).toBe(false);
    vi.stubEnv('EVIDENCE_E2E_DOUBLES', '');
    expect(evidenceE2EDoublesEnabled()).toBe(false);
    vi.stubEnv('EVIDENCE_E2E_DOUBLES', '   ');
    expect(evidenceE2EDoublesEnabled()).toBe(false);
  });

  it('con valor: el doble', () => {
    vi.stubEnv('EVIDENCE_E2E_DOUBLES', '1');
    expect(evidenceE2EDoublesEnabled()).toBe(true);
  });
});

describe('readEvidenceStorageConfigFromEnv (R30)', () => {
  it('R30: lee la direccion, el bucket propio de evidencias y la credencial', () => {
    vi.stubEnv('SUPABASE_STORAGE_URL', 'https://proyecto.supabase.co/storage/v1');
    vi.stubEnv('SUPABASE_EVIDENCE_BUCKET', 'evidencias');
    vi.stubEnv('SUPABASE_STORAGE_KEY', 'clave-secreta');
    expect(readEvidenceStorageConfigFromEnv()).toEqual({
      url: 'https://proyecto.supabase.co/storage/v1',
      bucket: 'evidencias',
      key: 'clave-secreta',
    });
  });

  it('R30: si faltan, el error las nombra todas y no filtra ningun valor', () => {
    vi.stubEnv('SUPABASE_STORAGE_URL', 'https://proyecto.supabase.co/storage/v1');
    vi.stubEnv('SUPABASE_EVIDENCE_BUCKET', ' ');
    vi.stubEnv('SUPABASE_STORAGE_KEY', undefined);
    expect(() => readEvidenceStorageConfigFromEnv()).toThrow(
      'faltan las variables de entorno: SUPABASE_EVIDENCE_BUCKET, SUPABASE_STORAGE_KEY',
    );
    try {
      readEvidenceStorageConfigFromEnv();
    } catch (error) {
      expect(String(error)).not.toContain('proyecto.supabase.co');
    }
  });

  it('R30: no lee el bucket de otro proposito', () => {
    vi.stubEnv('SUPABASE_STORAGE_URL', 'https://proyecto.supabase.co/storage/v1');
    vi.stubEnv('SUPABASE_STORAGE_KEY', 'clave-secreta');
    vi.stubEnv('SUPABASE_EVIDENCE_BUCKET', undefined);
    vi.stubEnv('SUPABASE_DOCUMENTS_BUCKET', 'documentos');
    vi.stubEnv('SUPABASE_STORAGE_BUCKET', 'imagenes');
    expect(() => readEvidenceStorageConfigFromEnv()).toThrow('SUPABASE_EVIDENCE_BUCKET');
  });
});
