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
  updateConnection: vi.fn(),
  listProviders: vi.fn(),
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
  updateAiProviderConnection: m.updateConnection,
  deleteAiProviderConnection: vi.fn(),
}));
vi.mock('@/lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma', () => ({
  listAiProviders: m.listProviders,
  getAiProvider: m.getProvider,
}));
vi.mock('@/lib/modules/integraciones/adapters/driven/security/secret-cipher-aes-gcm', () => ({
  secretCipherAesGcm: { encrypt: vi.fn(), decrypt: m.decrypt },
}));
// El trabajo pregunta primero si la empresa tiene la lectura de PDF activa: aquí la tiene, para
// que estos casos lleguen al lector como antes.
vi.mock('@/lib/modules/identity/adapters/driven/persistence/company-addons-prisma', () => ({
  createCompanyAddonRepository: () => ({
    findByCompany: async () => ({ stored: ['integraciones', 'lectura_pdf'], alive: true }),
    apply: async () => {
      throw new Error('el trabajo de la cola no escribe añadidos');
    },
  }),
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
    models: [
      { modelId: `modelo-mejor-${code}`, isDefault: false },
      { modelId: `modelo-predeterminado-${code}`, isDefault: true },
    ],
    defaultModel: `modelo-predeterminado-${code}`,
  };
}

function connectionOf(
  provider: AiProviderCode,
  status: AiProviderConnectionStatus = 'ACTIVE',
  model: string | null = null,
) {
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
    model,
    unavailableModel: null,
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
  m.listProviders.mockResolvedValue([]);
  m.updateConnection.mockResolvedValue(null);
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

  it('R40, QT-291 R19 — sin la variable cada codigo usa su propia prueba, con la key y solo el predeterminado del catalogo', async () => {
    for (const code of CODES) {
      for (const probe of ALL_PROBES) probe.mockClear();

      const result = await integraciones.testAiProviderKey({ provider: code, apiKey: API_KEY }, INTEGRATIONS_ADMIN);

      expect(result, code).toEqual({ status: 'tested', ok: true, elapsedMs: 1234 });
      expect(PROBE_OF[code], code).toHaveBeenCalledWith({
        apiKey: API_KEY,
        models: [`modelo-predeterminado-${code}`],
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

describe('elegir modelo: la misma prueba de la key, doble o real segun INTEGRATIONS_E2E_DOUBLES', () => {
  it('QT-291 R32 — sin la variable consulta con la prueba de su codigo solo el modelo elegido, con la key descifrada, y guarda', async () => {
    for (const code of CODES) {
      for (const probe of ALL_PROBES) probe.mockClear();
      m.updateConnection.mockClear();
      m.findConnection.mockResolvedValue(connectionOf(code));
      m.updateConnection.mockResolvedValue(connectionOf(code, 'ACTIVE', `modelo-mejor-${code}`));

      const result = await integraciones.selectAiModel({ modelId: `modelo-mejor-${code}` }, INTEGRATIONS_ADMIN);

      expect(result, code).toMatchObject({ status: 'saved', connection: { modelInUse: `modelo-mejor-${code}` } });
      expect(PROBE_OF[code], code).toHaveBeenCalledTimes(1);
      expect(PROBE_OF[code], code).toHaveBeenCalledWith({ apiKey: DECRYPTED_KEY, models: [`modelo-mejor-${code}`] });
      for (const other of CODES.filter((c) => c !== code)) {
        expect(PROBE_OF[other], `${code} no deberia llamar a la prueba de ${other}`).not.toHaveBeenCalled();
      }
      expect(m.updateConnection, code).toHaveBeenCalledTimes(1);
      expect(m.updateConnection.mock.calls[0]?.[1], code).toMatchObject({ model: `modelo-mejor-${code}` });
    }
  });

  it('QT-291 R33 — sin la variable, una consulta fallida no escribe y devuelve el mensaje de la prueba', async () => {
    m.findConnection.mockResolvedValue(connectionOf('GOOGLE'));
    m.probeGenai.mockResolvedValue({ ok: false, failure: { kind: 'rejected_key', httpStatus: 401, model: null } });

    const result = await integraciones.selectAiModel({ modelId: 'modelo-mejor-GOOGLE' }, INTEGRATIONS_ADMIN);

    expect(result).toMatchObject({ status: 'rejected' });
    expect(m.updateConnection).not.toHaveBeenCalled();
  });

  it('QT-291 R32 — con la variable responde el doble de la prueba: ningun SDK se llama y la eleccion se guarda', async () => {
    vi.stubEnv('INTEGRATIONS_E2E_DOUBLES', '1');
    m.findConnection.mockResolvedValue(connectionOf('ANTHROPIC'));
    m.updateConnection.mockResolvedValue(connectionOf('ANTHROPIC', 'ACTIVE', 'modelo-mejor-ANTHROPIC'));

    const result = await integraciones.selectAiModel({ modelId: 'modelo-mejor-ANTHROPIC' }, INTEGRATIONS_ADMIN);

    expect(result).toMatchObject({ status: 'saved' });
    for (const probe of ALL_PROBES) expect(probe).not.toHaveBeenCalled();
    expect(m.updateConnection).toHaveBeenCalledTimes(1);
  });

  it('QT-291 R32 — con la variable, una key guardada que empieza por E2E_INVALID sale rechazada sin escribir', async () => {
    vi.stubEnv('INTEGRATIONS_E2E_DOUBLES', '1');
    m.findConnection.mockResolvedValue(connectionOf('OPENAI'));
    m.decrypt.mockReturnValue(`${CANNED_INVALID_KEY_PREFIX}-guardada`);

    const result = await integraciones.selectAiModel({ modelId: 'modelo-mejor-OPENAI' }, INTEGRATIONS_ADMIN);

    expect(result).toMatchObject({ status: 'rejected' });
    for (const probe of ALL_PROBES) expect(probe).not.toHaveBeenCalled();
    expect(m.updateConnection).not.toHaveBeenCalled();
  });

  it('QT-291 R5 — las opciones salen del catalogo: ver la conexion no llama a ninguna prueba ni construye ningun lector', async () => {
    m.listProviders.mockResolvedValue(CODES.map(entryOf));
    m.findConnection.mockResolvedValue(connectionOf('OPENROUTER'));

    const overview = await integraciones.getAiProviderConnection(INTEGRATIONS_ADMIN);

    expect(JSON.stringify(overview)).toContain('modelo-mejor-OPENROUTER');
    for (const probe of ALL_PROBES) expect(probe).not.toHaveBeenCalled();
    for (const factory of ALL_READER_FACTORIES) expect(factory).not.toHaveBeenCalled();
  });
});

describe('la lectura: el lector de la empresa o el doble segun DOCUMENTS_E2E_DOUBLES', () => {
  it('R21, R22, QT-291 R16 — sin la variable cada codigo construye su lector con la key descifrada y el modelo en uso, el mismo en las dos estrategias', async () => {
    for (const [strategy, chosen, modelOf] of [
      ['formula', null, (c: AiProviderCode) => `modelo-predeterminado-${c}`],
      ['catalogo', null, (c: AiProviderCode) => `modelo-predeterminado-${c}`],
      ['formula', 'mejor', (c: AiProviderCode) => `modelo-mejor-${c}`],
      ['catalogo', 'mejor', (c: AiProviderCode) => `modelo-mejor-${c}`],
    ] as const) {
      for (const code of CODES) {
        for (const factory of ALL_READER_FACTORIES) factory.mockClear();
        withBatch(strategy);
        m.findConnection.mockResolvedValue(
          connectionOf(code, 'ACTIVE', chosen === null ? null : `modelo-${chosen}-${code}`),
        );

        await runJob();

        const expected = { apiKey: DECRYPTED_KEY, model: modelOf(code) };
        const label = `${strategy} / ${chosen ?? 'predeterminado'} / ${code}`;
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
    // QC-275 2026-10-13: el vigilante ve TODA lectura de `process.env` del proceso, no solo las
    // de la app. En CI (Node 24) el cargador CJS de Node lee `WATCH_REPORT_DEPENDENCIES` en cada
    // `require` (modo --watch) y el caso salia rojo con 40 lecturas que no son de la app; en local
    // (Node 22) no ocurre. Se ignoran SOLO las variables del runtime de esta lista explicita y
    // cerrada; cualquier otra lectura -toda variable del proyecto- sigue poniendo esto en rojo.
    const RUNTIME_ENV_VARS: ReadonlySet<string> = new Set([
      // Node `lib/internal/modules/cjs/loader.js` (reportModuleToWatchMode).
      'WATCH_REPORT_DEPENDENCIES',
    ]);
    const ofTheApp = (keys: readonly string[]): string[] =>
      keys.filter((key) => !RUNTIME_ENV_VARS.has(key));
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
      // Simula la lectura del runtime que hace Node 24 en CI: la ve el vigilante, pero el filtro
      // la descarta sin descartar la centinela.
      void process.env.WATCH_REPORT_DEPENDENCIES;
    } finally {
      process.env = original;
    }

    expect(ofTheApp(readByImport)).toEqual([]);
    expect(read).toContain('WATCH_REPORT_DEPENDENCIES');
    expect(ofTheApp(read.slice(readByImport.length))).toEqual(['VARIABLE_CENTINELA_QC275']);
    expect(m.findConnection).not.toHaveBeenCalled();
    expect(m.getProvider).not.toHaveBeenCalled();
    for (const probe of ALL_PROBES) expect(probe).not.toHaveBeenCalled();
    for (const factory of ALL_READER_FACTORIES) expect(factory).not.toHaveBeenCalled();
  });
});
