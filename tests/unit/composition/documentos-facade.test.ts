// La FACHADA ya cableada del modulo `documentos`.
//
// Lo que se afirma aqui es el CABLEADO, no el dominio: el censo cerrado de claves, que construir la
// fachada NO lee las variables del texto de los prompts ni toca la red, y que ningun adaptador de IA
// se invoca al importar. La lectura con IA ya no sale por la fachada: el lector es de cada empresa y
// lo construye el trabajo de la cola (`tests/unit/composition/ai-provider-wiring.test.ts`).
//
// Mismo criterio que `tests/unit/composition/asignaciones-facade.test.ts`: se sustituye el
// cliente Prisma entero -`lib/composition` arrastra todos los adaptadores del repo- y no hace
// falta ni Postgres ni `DATABASE_URL`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createAnthropicReaderMock, descargaRealMock, descargaDobleMock } = vi.hoisted(() => {
  delete process.env.CATALOG_PROMPT;
  delete process.env.FORMULA_PROMPT;
  return {
    createAnthropicReaderMock: vi.fn(),
    descargaRealMock: vi.fn(async () => new Uint8Array([1])),
    descargaDobleMock: vi.fn(async () => new Uint8Array([2])),
  };
});

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/modules/documentos/adapters/driven/ai/ai-reader-anthropic', () => ({
  createAnthropicReader: createAnthropicReaderMock,
  probeAnthropic: vi.fn(),
}));
// Los DOS adaptadores del almacenamiento, doblados a la vez: la eleccion se observa mirando cual
// de los dos recibio la llamada, que es la unica forma de afirmar sobre el cableado sin bucket.
vi.mock('@/lib/modules/documentos/adapters/driven/storage/document-storage-supabase', () => ({
  createDocumentSignedUpload: vi.fn(),
  createDocumentSignedReadUrl: vi.fn(),
  downloadDocument: descargaRealMock,
  removeDocument: vi.fn(),
}));
vi.mock('@/lib/modules/documentos/adapters/driven/storage/document-storage-memory', () => ({
  documentStorageMemory: {
    createSignedUpload: vi.fn(),
    createSignedReadUrl: vi.fn(),
    download: descargaDobleMock,
    remove: vi.fn(),
  },
}));

import { documentos } from '@/lib/composition';

describe('documentos — el censo de la fachada cableada', () => {
  it('R21 — expone exactamente las doce claves del censo, y cada una con la forma que promete', () => {
    // 2026-09-18 (QC-111, `@upstash/qstash` y su Route Handler ya aprobados): el procesamiento en
    // cola suma cuatro claves legitimas al censo -- `enqueueBatch`, `getBatchStatus`,
    // `queueSignature` y `runDocumentJob` --. La lista sigue siendo un censo CERRADO comparado con
    // `toEqual`, nunca `toContain`: cualquier clave nueva que no se declare aqui pone este caso en
    // rojo.
    //
    // 2026-09-24 (importacion de catalogo desde PDF): suma `previewCatalogImport` y
    // `confirmCatalogImport`, los dos casos de uso de la revision. El censo sigue CERRADO.
    //
    // 2026-09-25 (QC-159, importacion de formula desde PDF): suma `previewFormulaImport` y
    // `confirmFormulaImport`, los dos casos de uso de esta revision.
    //
    // 2026-10-13 (QC-275): salen `readPdfWithAi` y `processPdfByStrategy`; el lector es de cada
    // empresa y la cadena se construye por trabajo.
    expect(Object.keys(documentos).sort()).toEqual(
      [
        'confirmCatalogImport',
        'confirmFormulaImport',
        'previewCatalogImport',
        'previewFormulaImport',
        'convertPdfs',
        'downloadDocument',
        'enqueueBatch',
        'getBatchStatus',
        'issueReadLink',
        'issueUploadLinks',
        'queueSignature',
        'runDocumentJob',
      ].sort(),
    );
    // `queueSignature` es el objeto del puerto -verificar una firma no es un caso de uso, R8-, no
    // una funcion: se comprueba aparte para no perder la afirmacion original sobre el resto.
    const clavesFuncion = (Object.keys(documentos) as (keyof typeof documentos)[]).filter(
      (clave) => clave !== 'queueSignature',
    );
    for (const clave of clavesFuncion) {
      expect(typeof documentos[clave]).toBe('function');
    }
    expect(typeof documentos.queueSignature).toBe('object');
    expect(typeof documentos.queueSignature.verify).toBe('function');
    expect(typeof documentos.queueSignature.messageIdOf).toBe('function');
  });

  it('R22 — la fachada ya no expone readPdfWithAi ni processPdfByStrategy: no hay lector global', () => {
    expect(Object.keys(documentos)).not.toContain('readPdfWithAi');
    expect(Object.keys(documentos)).not.toContain('processPdfByStrategy');
  });

  it('R26 — el cableado no invoca el adaptador de IA al construirse', () => {
    expect(createAnthropicReaderMock).not.toHaveBeenCalled();
  });
});

// La bifurcacion por entorno de `design.md > 8` de QC-107, observada por el puerto del
// almacenamiento: los tres puertos se eligen con la MISMA consulta, asi que doblar uno basta para
// afirmar cual de las dos ramas corre. `downloadDocument` es el camino mas corto hasta el puerto
// —no exige ningun permiso, solo que la ruta caiga bajo la empresa del actor—.
describe('documentos — la bifurcacion de los dobles de extremo a extremo', () => {
  const VARIABLE = 'DOCUMENTS_E2E_DOUBLES';
  const ACTOR = { id: 'quien-sea', companyId: 'empresa-a', permissions: [] };
  const RUTA = 'empresa-a/00000000-0000-4000-8000-000000000000.pdf';

  beforeEach(() => {
    delete process.env[VARIABLE];
    descargaRealMock.mockClear();
    descargaDobleMock.mockClear();
  });

  afterEach(() => {
    delete process.env[VARIABLE];
  });

  it('sin la variable de entorno, la composicion elige los adaptadores reales (R20)', async () => {
    expect(process.env[VARIABLE]).toBeUndefined();

    await documentos.downloadDocument(ACTOR, RUTA);

    expect(descargaRealMock).toHaveBeenCalledWith(RUTA);
    expect(descargaDobleMock).not.toHaveBeenCalled();
  });

  it('con la variable, la composicion elige los dobles (R20)', async () => {
    process.env[VARIABLE] = '1';

    await documentos.downloadDocument(ACTOR, RUTA);

    expect(descargaDobleMock).toHaveBeenCalledWith(RUTA);
    expect(descargaRealMock).not.toHaveBeenCalled();
  });
});
