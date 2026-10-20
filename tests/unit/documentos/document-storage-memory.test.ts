// El almacenamiento en memoria del E2E: solo lee lo que firmo, devuelve el PDF minimo y, con la
// marca en el nombre original, unos bytes que no son un PDF (QC-137 T22 1b: un archivo que falla
// en una tanda de dos). El nombre se inyecta: aqui no hay base.

import { describe, expect, it } from 'vitest';

import { countPages } from '@/lib/modules/documentos/adapters/driven/pdf/pdf-converter-unpdf';
import {
  createDocumentStorageMemory,
  UNREADABLE_E2E_NAME_MARK,
} from '@/lib/modules/documentos/adapters/driven/storage/document-storage-memory';

const RUTA = 'empresa-1/archivo-1.pdf';

function storageWithName(name: string | null) {
  return createDocumentStorageMemory({ originalNameOf: () => Promise.resolve(name) });
}

describe('documentos — almacenamiento en memoria del E2E', () => {
  it('sin la marca devuelve un PDF de una pagina', async () => {
    const storage = storageWithName('catalogo.pdf');
    await storage.createSignedUpload(RUTA);

    const bytes = await storage.download(RUTA);
    expect(await countPages(bytes)).toBe(1);
  });

  it('sin nombre original devuelve el mismo PDF de una pagina', async () => {
    const storage = storageWithName(null);
    await storage.createSignedUpload(RUTA);

    expect(await countPages(await storage.download(RUTA))).toBe(1);
  });

  it(`con "${UNREADABLE_E2E_NAME_MARK}" en el nombre original devuelve bytes que no abren como PDF`, async () => {
    const storage = storageWithName(`proveedor_${UNREADABLE_E2E_NAME_MARK}_1.pdf`);
    await storage.createSignedUpload(RUTA);

    const bytes = await storage.download(RUTA);
    expect(bytes.byteLength).toBeGreaterThan(0);
    await expect(countPages(bytes)).rejects.toThrow();
  });

  it('una marca parecida no basta: compara la cadena entera', async () => {
    const storage = storageWithName('proveedor_e2e-legible.pdf');
    await storage.createSignedUpload(RUTA);

    expect(await countPages(await storage.download(RUTA))).toBe(1);
  });

  it('no descarga una ruta que no firmo, aunque lleve la marca', async () => {
    const storage = storageWithName(UNREADABLE_E2E_NAME_MARK);
    expect(() => storage.download(RUTA)).toThrow(/no firmo la ruta/);
  });

  it('dos instancias no comparten firmas', async () => {
    const a = storageWithName(null);
    const b = storageWithName(null);
    await a.createSignedUpload(RUTA);
    expect(() => b.download(RUTA)).toThrow(/no firmo la ruta/);
  });
});
