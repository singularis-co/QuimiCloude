// El adaptador `@google/genai`: la lectura con la key y el modelo de la empresa, la prueba de la
// conexion y la clasificacion de sus fallos.
//
// Ningun caso de este archivo toca la red: el cliente se dobla con `vi.mock`, y `ApiError` es la
// clase REAL de la libreria, para que la clasificacion se pruebe contra lo que el SDK lanza. El
// caso «el doble reemplaza a la libreria de verdad» es el que sostiene que no hay red.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiProviderError } from '@/lib/modules/documentos/domain/errors';

const generateContent = vi.fn();
const get = vi.fn();

class GoogleGenAIDouble {
  models = { generateContent, get };
}

vi.mock('@google/genai', async (importOriginal) => {
  const real = await importOriginal<typeof import('@google/genai')>();
  return {
    ApiError: real.ApiError,
    GoogleGenAI: vi.fn(GoogleGenAIDouble),
    createPartFromBase64: vi.fn((data: string, mimeType: string) => ({
      inlineData: { data, mimeType },
    })),
    createPartFromText: vi.fn((text: string) => ({ text })),
    createUserContent: vi.fn((parts: unknown) => ({ role: 'user', parts })),
  };
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const ADAPTADOR = 'lib/modules/documentos/adapters/driven/ai/ai-reader-genai.ts';
const KEY = 'AIza-CLAVE-RECONOCIBLE';
const CONFIG = { apiKey: KEY, model: 'modelo-de-catalogo' };
const LEER = { prompt: 'x', parts: [], timeoutMs: 1000 } as const;

function archivosDe(absDir: string): readonly string[] {
  if (!existsSync(absDir)) return [];
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(ts|tsx|mts|mjs|js)$/.test(ruta)) salida.push(ruta);
    }
  };
  recorrer(absDir);
  return salida;
}

function toPosix(ruta: string): string {
  return ruta.split(sep).join('/');
}

function fuenteSinComentarios(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/[^\n]*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function importaGenai(source: string): boolean {
  return /from\s+['"]@google\/genai['"]|require\(\s*['"]@google\/genai['"]\s*\)|import\(\s*['"]@google\/genai['"]\s*\)/.test(
    fuenteSinComentarios(source),
  );
}

async function adaptador() {
  return import('@/lib/modules/documentos/adapters/driven/ai/ai-reader-genai');
}

async function sdk() {
  return import('@google/genai');
}

/** Un `ApiError` real: la libreria copia el cuerpo de la respuesta en el mensaje. */
async function errorHttp(status: number, cuerpo = `{"error":{"message":"fallo con ${KEY}"}}`) {
  const { ApiError } = await sdk();
  return new ApiError({ message: cuerpo, status });
}

describe('documentos — el adaptador de Gemini (@google/genai)', () => {
  afterEach(async () => {
    generateContent.mockReset();
    get.mockReset();
    vi.mocked((await sdk()).GoogleGenAI).mockClear();
  });

  describe('R22 — la libreria vive en un solo archivo de produccion', () => {
    const ARBOL_VIGILADO = ['lib', 'app', 'components', 'scripts'];

    it('R22 — el barrido recorre de verdad el arbol vigilado', () => {
      const fuentes = ARBOL_VIGILADO.flatMap((dir) => archivosDe(join(repoRoot, dir)));
      expect(fuentes.length).toBeGreaterThan(100);
    });

    it('R22 — un unico archivo de produccion importa @google/genai, y es el adaptador', () => {
      const fuentes = ARBOL_VIGILADO.flatMap((dir) => archivosDe(join(repoRoot, dir)));
      const importadores = fuentes
        .filter((abs) => importaGenai(readFileSync(abs, 'utf8')))
        .map((abs) => toPosix(relative(repoRoot, abs)))
        .sort();

      expect(importadores).toEqual([ADAPTADOR]);
    });

    it('R22 — el detector dispara: un import de la libreria en otro archivo seria un hallazgo', () => {
      expect(importaGenai("import { GoogleGenAI } from '@google/genai';")).toBe(true);
      expect(importaGenai("// se nombra @google/genai en un comentario")).toBe(false);
    });
  });

  describe('R22 — la config llega por parametro', () => {
    it('R22 — el adaptador no lee ninguna variable de entorno', () => {
      const fuente = fuenteSinComentarios(readFileSync(join(repoRoot, ADAPTADOR), 'utf8'));
      expect(fuente).not.toMatch(/process\.env/);
      expect(fuente).not.toMatch(/GEMINI_/);
    });

    it('R22 — importar el adaptador no construye cliente ni llama a la libreria', async () => {
      const modulo = await adaptador();
      expect(typeof modulo.createGenaiReader).toBe('function');
      expect((await sdk()).GoogleGenAI).not.toHaveBeenCalled();
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('R22 — cada lector usa SU key y SU modelo: dos empresas no se mezclan', async () => {
      generateContent.mockResolvedValue({ text: 'ok' });
      const { createGenaiReader } = await adaptador();

      await createGenaiReader({ apiKey: 'key-a', model: 'modelo-a' }).read(LEER);
      await createGenaiReader({ apiKey: 'key-b', model: 'modelo-b' }).read(LEER);

      const constructor = (await sdk()).GoogleGenAI;
      expect(constructor).toHaveBeenNthCalledWith(1, { apiKey: 'key-a' });
      expect(constructor).toHaveBeenNthCalledWith(2, { apiKey: 'key-b' });
      expect(generateContent.mock.calls.map((llamada) => (llamada[0] as { model: string }).model)).toEqual([
        'modelo-a',
        'modelo-b',
      ]);
    });
  });

  describe('R6 — el texto de la respuesta se devuelve tal cual, con el cliente doblado', () => {
    it('R6, R26 — devuelve exactamente response.text, sin recortar ni interpretar', async () => {
      generateContent.mockResolvedValue({ text: '  Texto  con espacios  raros.\n\n' });
      const { createGenaiReader } = await adaptador();

      const resultado = await createGenaiReader(CONFIG).read({
        prompt: 'lee el documento',
        parts: [{ kind: 'pdf', bytes: new Uint8Array([1, 2, 3]) }],
        timeoutMs: 5000,
      });

      expect(resultado).toBe('  Texto  con espacios  raros.\n\n');
      expect(generateContent).toHaveBeenCalledTimes(1);
      const cuerpo = generateContent.mock.calls[0]?.[0] as {
        model: string;
        config: { httpOptions: { timeout: number }; abortSignal: AbortSignal };
      };
      expect(cuerpo.model).toBe('modelo-de-catalogo');
      expect(cuerpo.config.httpOptions.timeout).toBe(5000);
      expect(cuerpo.config.abortSignal).toBeInstanceOf(AbortSignal);
    });

    it('R26 — el doble reemplaza a la libreria de verdad: ninguna llamada real ocurre', async () => {
      generateContent.mockResolvedValue({ text: 'ok' });
      const { createGenaiReader } = await adaptador();

      await createGenaiReader(CONFIG).read(LEER);

      const genai = await sdk();
      expect(vi.isMockFunction(genai.GoogleGenAI)).toBe(true);
      expect(genai.GoogleGenAI).toHaveBeenCalledWith({ apiKey: KEY });
    });

    it('R6 — si la respuesta no trae texto, lanza nombrando la operacion en vez de devolver algo', async () => {
      generateContent.mockResolvedValue({ text: undefined });
      const { createGenaiReader } = await adaptador();

      await expect(createGenaiReader(CONFIG).read(LEER)).rejects.toThrowError(/gemini/i);
    });
  });

  describe('un fallo de cuenta al leer es `AiProviderError`; el resto, el error de siempre (R25, R26)', () => {
    it.each([
      [401, 'rejected_key'],
      [403, 'rejected_key'],
      [402, 'quota'],
      [429, 'quota'],
    ] as const)('R25 — %i al leer lanza AiProviderError (%s) sin la key ni el cuerpo', async (status, kind) => {
      generateContent.mockRejectedValue(await errorHttp(status));
      const { createGenaiReader } = await adaptador();

      const error = await createGenaiReader(CONFIG).read(LEER).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AiProviderError);
      const deCuenta = error as AiProviderError;
      expect(deCuenta.failure).toEqual({ kind, httpStatus: status, model: null });
      expect(deCuenta.diagnostic).toBe(`gemini generateContent respondió ${status}`);
      expect(JSON.stringify({ m: deCuenta.message, d: deCuenta.diagnostic })).not.toContain(KEY);
    });

    it('R25 — un 400 con `API_KEY_INVALID` en el cuerpo es una key rechazada', async () => {
      generateContent.mockRejectedValue(
        await errorHttp(400, '{"error":{"code":400,"details":[{"reason":"API_KEY_INVALID"}]}}'),
      );
      const { createGenaiReader } = await adaptador();

      const error = await createGenaiReader(CONFIG).read(LEER).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).failure).toEqual({ kind: 'rejected_key', httpStatus: 400, model: null });
    });

    it.each([400, 404, 500])('R26 — %i (sin motivo de key) al leer se propaga tal cual', async (status) => {
      const original = await errorHttp(status);
      generateContent.mockRejectedValue(original);
      const { createGenaiReader } = await adaptador();

      await expect(createGenaiReader(CONFIG).read(LEER)).rejects.toBe(original);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it('R26 — un fallo de red se propaga tal cual, sin AiProviderError', async () => {
      const original = new TypeError('fetch failed');
      generateContent.mockRejectedValue(original);
      const { createGenaiReader } = await adaptador();

      await expect(createGenaiReader(CONFIG).read(LEER)).rejects.toBe(original);
    });
  });

  describe('la clasificacion de un fallo (R11)', () => {
    it('R11 — cada codigo cae en su tipo; el 404 solo es de modelo si se consultaba uno', async () => {
      const { classifyGenaiError } = await adaptador();

      expect(classifyGenaiError(await errorHttp(401), 'm')).toEqual({ kind: 'rejected_key', httpStatus: 401, model: null });
      expect(classifyGenaiError(await errorHttp(403), 'm')).toEqual({ kind: 'rejected_key', httpStatus: 403, model: null });
      expect(classifyGenaiError(await errorHttp(400, 'reason API_KEY_INVALID'), 'm')).toEqual({
        kind: 'rejected_key',
        httpStatus: 400,
        model: null,
      });
      expect(classifyGenaiError(await errorHttp(429), 'm')).toEqual({ kind: 'quota', httpStatus: 429, model: null });
      expect(classifyGenaiError(await errorHttp(404), 'm')).toEqual({ kind: 'model_unavailable', httpStatus: 404, model: 'm' });
      expect(classifyGenaiError(await errorHttp(404), null)).toEqual({ kind: 'unexpected', httpStatus: 404, model: null });
      expect(classifyGenaiError(await errorHttp(400), 'm')).toEqual({ kind: 'unexpected', httpStatus: 400, model: null });
      expect(classifyGenaiError(await errorHttp(503), 'm')).toEqual({ kind: 'unexpected', httpStatus: 503, model: null });
    });

    it('R11 — lo que no es `ApiError` es que no hubo respuesta: `unreachable`', async () => {
      const { classifyGenaiError } = await adaptador();
      const sinRespuesta = { kind: 'unreachable', httpStatus: null, model: null };

      expect(classifyGenaiError(new TypeError('fetch failed'), 'm')).toEqual(sinRespuesta);
      expect(classifyGenaiError(new DOMException('x', 'AbortError'), 'm')).toEqual(sinRespuesta);
    });
  });

  describe('la prueba de la conexion (R10)', () => {
    it('R10 — consulta cada modelo una vez, sin generar texto y con plazo de 10 s', async () => {
      get.mockResolvedValue({ name: 'x' });
      const { probeGenai } = await adaptador();

      const resultado = await probeGenai({ apiKey: KEY, models: ['receta', 'catalogo'] });

      expect(resultado.ok).toBe(true);
      expect(resultado.ok && resultado.elapsedMs).toBeGreaterThanOrEqual(0);
      expect((await sdk()).GoogleGenAI).toHaveBeenCalledWith({ apiKey: KEY });
      const llamadas = get.mock.calls.map(
        (llamada) => llamada[0] as { model: string; config: { abortSignal: AbortSignal; httpOptions: { timeout: number } } },
      );
      expect(llamadas.map((llamada) => llamada.model).sort()).toEqual(['catalogo', 'receta']);
      for (const llamada of llamadas) {
        expect(llamada.config.abortSignal).toBeInstanceOf(AbortSignal);
        expect(llamada.config.httpOptions.timeout).toBe(10_000);
        // Sin `retryOptions` la libreria no reintenta.
        expect(llamada.config.httpOptions).not.toHaveProperty('retryOptions');
      }
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('R10 — si receta y catalogo son el mismo modelo, se consulta una sola vez', async () => {
      get.mockResolvedValue({ name: 'x' });
      const { probeGenai } = await adaptador();

      await probeGenai({ apiKey: KEY, models: ['mismo', 'mismo'] });

      expect(get).toHaveBeenCalledTimes(1);
    });

    it('R11 — un 404 en un modelo da `model_unavailable` con ESE modelo', async () => {
      const noEsta = await errorHttp(404);
      get.mockImplementation(async ({ model }: { model: string }) => {
        if (model === 'receta') throw noEsta;
        return { name: model };
      });
      const { probeGenai } = await adaptador();

      expect(await probeGenai({ apiKey: KEY, models: ['receta', 'catalogo'] })).toEqual({
        ok: false,
        failure: { kind: 'model_unavailable', httpStatus: 404, model: 'receta' },
      });
    });

    it('R11 — sin red da `unreachable`', async () => {
      get.mockRejectedValue(new TypeError('fetch failed'));
      const { probeGenai } = await adaptador();

      expect(await probeGenai({ apiKey: KEY, models: ['receta'] })).toEqual({
        ok: false,
        failure: { kind: 'unreachable', httpStatus: null, model: null },
      });
    });
  });

  describe('la traduccion de partes es pura y se prueba en memoria (R6, R26)', () => {
    it('R6 — un PDF se traduce a base64 con application/pdf', async () => {
      const { toGenaiPart } = await adaptador();

      const parte = toGenaiPart({ kind: 'pdf', bytes: new Uint8Array([1, 2, 3]) }) as {
        inlineData: { data: string; mimeType: string };
      };

      expect(parte.inlineData.mimeType).toBe('application/pdf');
      expect(Buffer.from(parte.inlineData.data, 'base64')).toEqual(Buffer.from([1, 2, 3]));
    });

    it('R6 — una imagen se traduce a base64 con image/png', async () => {
      const { toGenaiPart } = await adaptador();

      const parte = toGenaiPart({
        kind: 'image',
        png: new Uint8Array([9, 9]),
        pageNumber: 1,
      }) as { inlineData: { data: string; mimeType: string } };

      expect(parte.inlineData.mimeType).toBe('image/png');
      expect(Buffer.from(parte.inlineData.data, 'base64')).toEqual(Buffer.from([9, 9]));
    });

    it('R26 — el cuerpo de la peticion lleva el prompt recibido por parametro, sin texto propio', async () => {
      const { buildGenaiContents } = await adaptador();

      const contenido = buildGenaiContents({
        prompt: 'un prompt cualquiera que llega por parametro',
        parts: [],
        timeoutMs: 1000,
      }) as { parts: readonly { text?: string }[] };

      expect(contenido.parts[0]?.text).toBe('un prompt cualquiera que llega por parametro');
    });
  });
});
