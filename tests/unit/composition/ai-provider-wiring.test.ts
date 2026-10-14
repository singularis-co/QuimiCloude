// El cableado del proveedor IA en `lib/composition`: que la prueba y la lectura eligen el doble o el
// adaptador real por su variable EN CADA LLAMADA, que cada codigo de proveedor elige su lector y su
// prueba, que con el doble de lectura no se descifra nada pero sigue haciendo falta conexion, y que
// importar la composicion no lee ninguna variable.
//
// Se doblan los adaptadores driven por su ruta (persistencia, catalogo, cifrado, almacenamiento y
// los tres archivos de SDK); los casos de uso y el dominio de `documentos` corren reales.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiProviderCode, AiProviderConnectionStatus } from '@/lib/modules/integraciones';

const m = vi.hoisted(() => ({
  findConnection: vi.fn(),
  getProvider: vi.fn(),
  decrypt: vi.fn(),
  claim: vi.fn(),
  readBatch: vi.fn(),
  finish: vi.fn(),
  downloadReal: vi.fn(),
  downloadDoble: vi.fn(),
  createAnthropicReader: vi.fn(),
  createGenaiReader: vi.fn(),
  createOpenAiReader: vi.fn(),
  probeAnthropic: vi.fn(),
  probeGenai: vi.fn(),
  probeOpenAi: vi.fn(),
  probeOpenRouter: vi.fn(),
}));

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/modules/integraciones/adapters/driven/persistence/ai-provider-connection-prisma', () => ({
  findAiProviderConnection: m.findConnection,
  insertAiProviderConnection: vi.fn(),
  updateAiProviderConnection: vi.fn(),
  deleteAiProviderConnection: vi.fn(),
}));
vi.mock('@/lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma', () => ({
  listAiProviders: vi.fn(),
  getAiProvider: m.getProvider,
}));
vi.mock('@/lib/modules/integraciones/adapters/driven/security/secret-cipher-aes-gcm', () => ({
  secretCipherAesGcm: { encrypt: vi.fn(), decrypt: m.decrypt },
}));
vi.mock('@/lib/modules/documentos/adapters/driven/persistence/document-batch-repository-prisma', () => ({
  documentBatchRepositoryPrisma: { claim: m.claim, readBatch: m.readBatch, finish: m.finish },
}));
vi.mock('@/lib/modules/documentos/adapters/driven/storage/document-storage-supabase', () => ({
  createDocumentSignedUpload: vi.fn(),
  createDocumentSignedReadUrl: vi.fn(),
  downloadDocument: m.downloadReal,
  removeDocument: vi.fn(),
}));
vi.mock('@/lib/modules/documentos/adapters/driven/storage/document-storage-memory', () => ({
  documentStorageMemory: {
    createSignedUpload: vi.fn(),
    createSignedReadUrl: vi.fn(),
    download: m.downloadDoble,
    remove: vi.fn(),
  },
}));
vi.mock('@/lib/modules/documentos/adapters/driven/ai/ai-reader-anthropic', () => ({
  createAnthropicReader: m.createAnthropicReader,
  probeAnthropic: m.probeAnthropic,
}));
vi.mock('@/lib/modules/documentos/adapters/driven/ai/ai-reader-genai', () => ({
  createGenaiReader: m.createGenaiReader,
  probeGenai: m.probeGenai,
}));
vi.mock('@/lib/modules/documentos/adapters/driven/ai/ai-reader-openai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modules/documentos/adapters/driven/ai/ai-reader-openai')>()),
  createOpenAiReader: m.createOpenAiReader,
  probeOpenAi: m.probeOpenAi,
  probeOpenRouter: m.probeOpenRouter,
}));

import { documentos, integraciones } from '@/lib/composition';
import { OPENROUTER_BASE_URL } from '@/lib/modules/documentos/adapters/driven/ai/ai-reader-openai';
import {
  CANNED_ELAPSED_MS,
  CANNED_INVALID_KEY_PREFIX,
} from '@/lib/modules/integraciones/adapters/driven/ai/ai-provider-probe-canned';

const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const FILE_ID = '44444444-4444-4444-8444-444444444444';
const BATCH_ID = '55555555-5555-4555-8555-555555555555';
const API_KEY = 'clave-escrita-de-prueba';
const DECRYPTED_KEY = 'clave-descifrada-de-prueba';

const INTEGRATIONS_ADMIN = {
  id: 'user-admin-1',
  companyId: COMPANY_ID,
  permissions: ['integraciones.modificar'],
};
const UPLOADER = { id: 'user-sube-1', companyId: COMPANY_ID, permissions: ['documentos.modificar'] };

const CODES: readonly AiProviderCode[] = ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'];

function entryOf(code: AiProviderCode) {
  return {
    code,
    name: `Nombre ${code}`,
    recipeModel: `modelo-receta-${code}`,
    catalogModel: `modelo-catalogo-${code}`,
  };
}

function connectionOf(provider: AiProviderCode, status: AiProviderConnectionStatus = 'ACTIVE') {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    companyId: COMPANY_ID,
    provider,
    apiKeyEnc: 'v1:valor-cifrado',
    status,
    lastError: null,
    lastErrorAt: null,
    lastCheckedAt: null,
    keyUpdatedAt: new Date('2026-10-13T12:00:00.000Z'),
  };
}

const PROBE_OF: Record<AiProviderCode, ReturnType<typeof vi.fn>> = {
  ANTHROPIC: m.probeAnthropic,
  GOOGLE: m.probeGenai,
  OPENAI: m.probeOpenAi,
  OPENROUTER: m.probeOpenRouter,
};

const ALL_READER_FACTORIES = [m.createAnthropicReader, m.createGenaiReader, m.createOpenAiReader];
const ALL_PROBES = Object.values(PROBE_OF);

function runJob() {
  return documentos.runDocumentJob({ documentFileId: FILE_ID, messageId: 'mensaje-1' });
}

function withBatch(strategy: 'formula' | 'catalogo'): void {
  m.claim.mockResolvedValue({
    id: FILE_ID,
    companyId: COMPANY_ID,
    batchId: BATCH_ID,
    path: `${COMPANY_ID}/${FILE_ID}.pdf`,
  });
  m.readBatch.mockResolvedValue({ id: BATCH_ID, companyId: COMPANY_ID, strategy, files: [] });
}

function finishedCode(): unknown {
  const outcome = m.finish.mock.calls.at(-1)?.[1] as { code?: unknown } | undefined;
  return outcome?.code;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('INTEGRATIONS_E2E_DOUBLES', '');
  vi.stubEnv('DOCUMENTS_E2E_DOUBLES', '');
  m.getProvider.mockImplementation(async (code: AiProviderCode) => entryOf(code));
  m.findConnection.mockResolvedValue(null);
  m.decrypt.mockReturnValue(DECRYPTED_KEY);
  m.finish.mockResolvedValue(undefined);
  m.downloadReal.mockRejectedValue(new Error('descarga real cortada en el test'));
  m.downloadDoble.mockRejectedValue(new Error('descarga doble cortada en el test'));
  for (const factory of ALL_READER_FACTORIES) factory.mockReturnValue({ read: vi.fn() });
  for (const probe of ALL_PROBES) probe.mockResolvedValue({ ok: true, elapsedMs: 1234 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('la prueba de la key: doble o real segun INTEGRATIONS_E2E_DOUBLES', () => {
  it('R40 — con la variable responde el doble: una key buena prueba bien y ningun SDK se llama', async () => {
    vi.stubEnv('INTEGRATIONS_E2E_DOUBLES', '1');

    const result = await integraciones.testAiProviderKey({ provider: 'GOOGLE', apiKey: API_KEY }, INTEGRATIONS_ADMIN);

    expect(result).toEqual({ status: 'tested', ok: true, elapsedMs: CANNED_ELAPSED_MS });
    for (const probe of ALL_PROBES) expect(probe).not.toHaveBeenCalled();
  });

  it('R40 — con la variable, una key que empieza por E2E_INVALID sale rechazada', async () => {
    vi.stubEnv('INTEGRATIONS_E2E_DOUBLES', '1');

    const result = await integraciones.testAiProviderKey(
      { provider: 'ANTHROPIC', apiKey: `${CANNED_INVALID_KEY_PREFIX}-x` },
      INTEGRATIONS_ADMIN,
    );

    expect(result).toMatchObject({ status: 'tested', ok: false });
    for (const probe of ALL_PROBES) expect(probe).not.toHaveBeenCalled();
  });

  it('R40 — sin la variable cada codigo usa su propia prueba, con la key y los dos modelos del catalogo', async () => {
    for (const code of CODES) {
      for (const probe of ALL_PROBES) probe.mockClear();

      const result = await integraciones.testAiProviderKey({ provider: code, apiKey: API_KEY }, INTEGRATIONS_ADMIN);

      expect(result, code).toEqual({ status: 'tested', ok: true, elapsedMs: 1234 });
      expect(PROBE_OF[code], code).toHaveBeenCalledWith({
        apiKey: API_KEY,
        models: [`modelo-receta-${code}`, `modelo-catalogo-${code}`],
      });
      for (const other of CODES.filter((c) => c !== code)) {
        expect(PROBE_OF[other], `${code} no deberia llamar a la prueba de ${other}`).not.toHaveBeenCalled();
      }
    }
  });

  it('R40 — la eleccion cambia dentro del mismo proceso, sin volver a importar la composicion', async () => {
    const input = { provider: 'OPENAI', apiKey: API_KEY };

    vi.stubEnv('INTEGRATIONS_E2E_DOUBLES', '1');
    await integraciones.testAiProviderKey(input, INTEGRATIONS_ADMIN);
    expect(m.probeOpenAi).not.toHaveBeenCalled();

    vi.stubEnv('INTEGRATIONS_E2E_DOUBLES', '');
    await integraciones.testAiProviderKey(input, INTEGRATIONS_ADMIN);
    expect(m.probeOpenAi).toHaveBeenCalledTimes(1);

    vi.stubEnv('INTEGRATIONS_E2E_DOUBLES', '1');
    await integraciones.testAiProviderKey(input, INTEGRATIONS_ADMIN);
    expect(m.probeOpenAi).toHaveBeenCalledTimes(1);
  });
});

describe('la lectura: el lector de la empresa o el doble segun DOCUMENTS_E2E_DOUBLES', () => {
  it('R21, R22 — sin la variable cada codigo construye su lector con la key descifrada y el modelo del uso', async () => {
    for (const [strategy, modelOf] of [
      ['formula', (c: AiProviderCode) => `modelo-receta-${c}`],
      ['catalogo', (c: AiProviderCode) => `modelo-catalogo-${c}`],
    ] as const) {
      for (const code of CODES) {
        for (const factory of ALL_READER_FACTORIES) factory.mockClear();
        withBatch(strategy);
        m.findConnection.mockResolvedValue(connectionOf(code));

        await runJob();

        const expected = { apiKey: DECRYPTED_KEY, model: modelOf(code) };
        const label = `${strategy} / ${code}`;
        if (code === 'ANTHROPIC') expect(m.createAnthropicReader, label).toHaveBeenCalledWith(expected);
        if (code === 'GOOGLE') expect(m.createGenaiReader, label).toHaveBeenCalledWith(expected);
        if (code === 'OPENAI') expect(m.createOpenAiReader, label).toHaveBeenCalledWith(expected);
        if (code === 'OPENROUTER') {
          expect(m.createOpenAiReader, label).toHaveBeenCalledWith({ ...expected, baseURL: OPENROUTER_BASE_URL });
        }
        const built = ALL_READER_FACTORIES.reduce((total, factory) => total + factory.mock.calls.length, 0);
        expect(built, `${label}: un solo lector por trabajo`).toBe(1);
        expect(m.downloadReal, label).toHaveBeenCalled();
      }
    }
  });

  it('R24 — sin la variable y sin conexion el archivo termina en ai_provider_missing sin descargar', async () => {
    withBatch('formula');

    await runJob();

    expect(finishedCode()).toBe('ai_provider_missing');
    expect(m.downloadReal).not.toHaveBeenCalled();
    expect(m.decrypt).not.toHaveBeenCalled();
  });

  it('R41 — con la variable y con conexion lee el doble: no descifra ni construye ningun lector de SDK', async () => {
    vi.stubEnv('DOCUMENTS_E2E_DOUBLES', '1');
    withBatch('catalogo');
    m.findConnection.mockResolvedValue(connectionOf('ANTHROPIC', 'ERROR'));

    await runJob();

    expect(m.decrypt).not.toHaveBeenCalled();
    for (const factory of ALL_READER_FACTORIES) expect(factory).not.toHaveBeenCalled();
    expect(m.downloadDoble).toHaveBeenCalled();
    expect(finishedCode()).not.toBe('ai_provider_missing');
  });

  it('R41 — con la variable y sin conexion el archivo termina en ai_provider_missing igual', async () => {
    vi.stubEnv('DOCUMENTS_E2E_DOUBLES', '1');
    withBatch('formula');

    await runJob();

    expect(finishedCode()).toBe('ai_provider_missing');
    expect(m.downloadDoble).not.toHaveBeenCalled();
    expect(m.decrypt).not.toHaveBeenCalled();
  });

  it('R23, R41 — la emision de enlaces exige conexion con y sin la variable', async () => {
    for (const value of ['', '1']) {
      vi.stubEnv('DOCUMENTS_E2E_DOUBLES', value);
      m.findConnection.mockResolvedValue(null);

      await expect(documentos.issueUploadLinks(UPLOADER, {}), `variable='${value}'`).rejects.toMatchObject({
        code: 'ai_provider_missing',
      });

      m.findConnection.mockResolvedValue(connectionOf('GOOGLE'));
      await expect(documentos.issueUploadLinks(UPLOADER, {}), `variable='${value}'`).rejects.toMatchObject({
        code: 'invalid_input',
      });
    }
    expect(m.decrypt).not.toHaveBeenCalled();
  });
});

describe('importar la composicion', () => {
  it('R42 — no lee ninguna variable de entorno, no consulta la base ni llama a un proveedor', async () => {
    vi.resetModules();
    const read: string[] = [];
    const original = process.env;
    process.env = new Proxy(original, {
      get(target, key, receiver) {
        if (typeof key === 'string') read.push(key);
        return Reflect.get(target, key, receiver);
      },
      has(target, key) {
        if (typeof key === 'string') read.push(key);
        return Reflect.has(target, key);
      },
    });
    let readByImport: string[] = [];
    try {
      await import('@/lib/composition');
      readByImport = [...read];
      // Sensibilidad: el vigilante si ve una lectura, asi que la lista vacia no es por vacuidad.
      void process.env.VARIABLE_CENTINELA_QC275;
    } finally {
      process.env = original;
    }

    expect(readByImport).toEqual([]);
    expect(read).toEqual(['VARIABLE_CENTINELA_QC275']);
    expect(m.findConnection).not.toHaveBeenCalled();
    expect(m.getProvider).not.toHaveBeenCalled();
    for (const probe of ALL_PROBES) expect(probe).not.toHaveBeenCalled();
    for (const factory of ALL_READER_FACTORIES) expect(factory).not.toHaveBeenCalled();
  });
});
