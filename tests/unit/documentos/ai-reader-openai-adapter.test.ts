// El adaptador `openai`, que sirve a OpenAI y a OpenRouter: la forma del mensaje, la URL base de
// OpenRouter, la prueba de cada uno y la clasificacion de sus fallos.
//
// Ningun caso toca la red: el cliente se dobla con `vi.mock` y las clases de error son las REALES
// de la libreria.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiProviderError } from '@/lib/modules/documentos/domain/errors';

const create = vi.fn();
const retrieve = vi.fn();
const list = vi.fn();
const get = vi.fn();

class OpenAiDouble {
  chat = { completions: { create } };
  models = { retrieve, list };
  get = get;
}

vi.mock('openai', async (importOriginal) => {
  const real = await importOriginal<typeof import('openai')>();
  return { ...real, default: vi.fn(OpenAiDouble) };
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ADAPTADOR = 'lib/modules/documentos/adapters/driven/ai/ai-reader-openai.ts';
const KEY = 'sk-CLAVE-RECONOCIBLE';
const CONFIG = { apiKey: KEY, model: 'modelo-de-receta' };
const LEER = { prompt: 'x', parts: [], timeoutMs: 1000 } as const;

async function adaptador() {
  return import('@/lib/modules/documentos/adapters/driven/ai/ai-reader-openai');
}

async function sdk() {
  return import('openai');
}

async function errorHttp(status: number) {
  const { APIError } = await sdk();
  return APIError.generate(status, { error: { message: `cuerpo con ${KEY}` } }, `fallo ${KEY}`, new Headers());
}

/** El cuerpo con el que OpenRouter responde al generar con un id que no existe (T0, 2026-10-22). */
async function errorDeIdInvalido(model: string) {
  return errorConMensaje(400, `${model} is not a valid model ID`);
}

async function errorConMensaje(status: number, message: string) {
  const { APIError } = await sdk();
  return APIError.generate(status, { error: { message, code: status } }, undefined, new Headers());
}

function respuesta(overrides: { content?: string | null; refusal?: string | null; finish_reason?: string }) {
  return {
    id: 'c',
    object: 'chat.completion',
    created: 0,
    model: 'modelo-de-receta',
    choices: [
      {
        index: 0,
        finish_reason: overrides.finish_reason ?? 'stop',
        logprobs: null,
        message: {
          role: 'assistant',
          content: overrides.content === undefined ? 'ok' : overrides.content,
          refusal: overrides.refusal ?? null,
        },
      },
    ],
  };
}

/** `models.list` devuelve una promesa de pagina; para el adaptador basta con `data`. */
function listado(ids: readonly string[]) {
  return Promise.resolve({ data: ids.map((id) => ({ id, object: 'model', created: 0, owned_by: 'x' })) });
}

describe('documentos — el adaptador de OpenAI y OpenRouter (openai)', () => {
  afterEach(async () => {
    create.mockReset();
    retrieve.mockReset();
    list.mockReset();
    get.mockReset();
    vi.mocked((await sdk()).default).mockClear();
  });

  describe('la config llega por parametro (R22)', () => {
    it('R22 — el adaptador no lee ninguna variable de entorno', () => {
      const fuente = readFileSync(join(repoRoot, ADAPTADOR), 'utf8');
      expect(fuente).not.toMatch(/process\.env/);
    });

    it('R22 — importar el adaptador no construye cliente', async () => {
      const modulo = await adaptador();
      expect(typeof modulo.createOpenAiReader).toBe('function');
      expect((await sdk()).default).not.toHaveBeenCalled();
    });
  });

  describe('la lectura (R29)', () => {
    it('R29 — OpenAI: cliente sin reintentos, con el plazo y sin URL base propia', async () => {
      create.mockResolvedValue(respuesta({}));
      const { createOpenAiReader } = await adaptador();

      await createOpenAiReader(CONFIG).read({ prompt: 'x', parts: [], timeoutMs: 4321 });

      expect((await sdk()).default).toHaveBeenCalledWith({ apiKey: KEY, maxRetries: 0, timeout: 4321 });
    });

    it('R29 — OpenRouter: el mismo SDK con la URL base de OpenRouter', async () => {
      create.mockResolvedValue(respuesta({}));
      const { createOpenAiReader, OPENROUTER_BASE_URL } = await adaptador();

      await createOpenAiReader({ ...CONFIG, baseURL: OPENROUTER_BASE_URL }).read(LEER);

      expect(OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1');
      expect((await sdk()).default).toHaveBeenCalledWith({
        apiKey: KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        maxRetries: 0,
        timeout: 1000,
      });
    });

    it('R29 — un mensaje de usuario: PDF como parte `file` en data URL, PNG como `image_url`, el prompt al final', async () => {
      create.mockResolvedValue(respuesta({}));
      const { createOpenAiReader } = await adaptador();

      await createOpenAiReader(CONFIG).read({
        prompt: 'lee el documento',
        parts: [
          { kind: 'pdf', bytes: new Uint8Array([1, 2, 3]) },
          { kind: 'image', png: new Uint8Array([9, 9]), pageNumber: 1 },
        ],
        timeoutMs: 5000,
      });

      expect(create).toHaveBeenCalledTimes(1);
      const [cuerpo, opciones] = create.mock.calls[0] as [Record<string, unknown>, { signal: AbortSignal }];
      expect(Object.keys(cuerpo).sort()).toEqual(['max_completion_tokens', 'messages', 'model']);
      expect(cuerpo.model).toBe('modelo-de-receta');
      expect(cuerpo.max_completion_tokens).toBe(16000);
      expect(cuerpo.messages).toEqual([
        {
          role: 'user',
          content: [
            { type: 'file', file: { filename: 'documento.pdf', file_data: 'data:application/pdf;base64,AQID' } },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${Buffer.from([9, 9]).toString('base64')}` } },
            { type: 'text', text: 'lee el documento' },
          ],
        },
      ]);
      expect(opciones.signal).toBeInstanceOf(AbortSignal);
    });

    it('R29 — devuelve el texto tal cual', async () => {
      create.mockResolvedValue(respuesta({ content: '  Texto  raro.\n\n' }));
      const { createOpenAiReader } = await adaptador();

      expect(await createOpenAiReader(CONFIG).read(LEER)).toBe('  Texto  raro.\n\n');
    });

    it('R29 — `finish_reason: length` lanza en vez de devolver una lectura incompleta', async () => {
      create.mockResolvedValue(respuesta({ content: 'a medias', finish_reason: 'length' }));
      const { createOpenAiReader } = await adaptador();

      await expect(createOpenAiReader(CONFIG).read(LEER)).rejects.toThrowError(/limite de tokens/);
    });

    it('R29 — una negativa lanza y no vuelca su texto', async () => {
      create.mockResolvedValue(respuesta({ content: null, refusal: 'NEGATIVA-RECONOCIBLE' }));
      const { createOpenAiReader } = await adaptador();

      const error = await createOpenAiReader(CONFIG).read(LEER).catch((e: unknown) => e);
      expect((error as Error).message).toMatch(/rechazada/);
      expect((error as Error).message).not.toContain('NEGATIVA-RECONOCIBLE');
      expect(error).not.toBeInstanceOf(AiProviderError);
    });

    it('R29 — sin texto ni respuesta lanza nombrando al proveedor', async () => {
      const { createOpenAiReader } = await adaptador();
      create.mockResolvedValueOnce(respuesta({ content: null }));
      await expect(createOpenAiReader(CONFIG).read(LEER)).rejects.toThrowError(/openai/i);
      create.mockResolvedValueOnce({ ...respuesta({}), choices: [] });
      await expect(createOpenAiReader(CONFIG).read(LEER)).rejects.toThrowError(/openai/i);
    });
  });

  describe('un fallo de cuenta al leer es `AiProviderError`; el resto, el error de siempre (R25, R26)', () => {
    it.each([
      [401, 'rejected_key'],
      [403, 'rejected_key'],
      [402, 'quota'],
      [429, 'quota'],
    ] as const)('R25 — %i al leer lanza AiProviderError (%s) sin la key ni el cuerpo', async (status, kind) => {
      create.mockRejectedValue(await errorHttp(status));
      const { createOpenAiReader, OPENROUTER_BASE_URL } = await adaptador();

      const error = await createOpenAiReader({ ...CONFIG, baseURL: OPENROUTER_BASE_URL })
        .read(LEER)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AiProviderError);
      const deCuenta = error as AiProviderError;
      expect(deCuenta.failure).toEqual({ kind, httpStatus: status, model: null });
      expect(deCuenta.diagnostic).toBe(`openrouter chat.completions.create respondió ${status}`);
      expect(JSON.stringify({ m: deCuenta.message, d: deCuenta.diagnostic })).not.toContain(KEY);
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('R25 — con OpenAI el diagnostico nombra a OpenAI', async () => {
      create.mockRejectedValue(await errorHttp(401));
      const { createOpenAiReader } = await adaptador();

      const error = (await createOpenAiReader(CONFIG).read(LEER).catch((e: unknown) => e)) as AiProviderError;
      expect(error.diagnostic).toBe('openai chat.completions.create respondió 401');
    });

    it.each([400, 500])('R26 — %i al leer se propaga tal cual', async (status) => {
      const original = await errorHttp(status);
      create.mockRejectedValue(original);
      const { createOpenAiReader } = await adaptador();

      await expect(createOpenAiReader(CONFIG).read(LEER)).rejects.toBe(original);
    });

    it.each([
      ['OpenAI', undefined, 'openai'],
      ['OpenRouter', 'https://openrouter.ai/api/v1', 'openrouter'],
    ] as const)('QT-291 R23 — %s: un 404 al leer lanza AiProviderError con el modelo en uso, sin la key ni el cuerpo', async (_nombre, baseURL, etiqueta) => {
      create.mockRejectedValue(await errorHttp(404));
      const { createOpenAiReader } = await adaptador();

      const error = await createOpenAiReader({ ...CONFIG, ...(baseURL === undefined ? {} : { baseURL }) })
        .read(LEER)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AiProviderError);
      const fallo = error as AiProviderError;
      expect(fallo.failure).toEqual({ kind: 'model_unavailable', httpStatus: 404, model: 'modelo-de-receta' });
      expect(fallo.diagnostic).toBe(`${etiqueta} chat.completions.create respondió 404`);
      expect(JSON.stringify({ m: fallo.message, d: fallo.diagnostic })).not.toContain(KEY);
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('QT-291 R23 — OpenRouter: el 400 «<id> is not a valid model ID» del modelo en uso es modelo no disponible', async () => {
      create.mockRejectedValue(await errorDeIdInvalido('modelo-de-receta'));
      const { createOpenAiReader, OPENROUTER_BASE_URL } = await adaptador();

      const error = await createOpenAiReader({ ...CONFIG, baseURL: OPENROUTER_BASE_URL })
        .read(LEER)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AiProviderError);
      const fallo = error as AiProviderError;
      expect(fallo.failure).toEqual({ kind: 'model_unavailable', httpStatus: 400, model: 'modelo-de-receta' });
      expect(fallo.diagnostic).toBe('openrouter chat.completions.create respondió 400');
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('QT-291 R23 — un 400 distinto de OpenRouter, o ese mismo 400 con OpenAI, se propaga tal cual', async () => {
      const { createOpenAiReader, OPENROUTER_BASE_URL } = await adaptador();

      const otro400 = await errorHttp(400);
      create.mockRejectedValueOnce(otro400);
      await expect(createOpenAiReader({ ...CONFIG, baseURL: OPENROUTER_BASE_URL }).read(LEER)).rejects.toBe(otro400);

      const deOtroModelo = await errorDeIdInvalido('otro-modelo');
      create.mockRejectedValueOnce(deOtroModelo);
      await expect(createOpenAiReader({ ...CONFIG, baseURL: OPENROUTER_BASE_URL }).read(LEER)).rejects.toBe(deOtroModelo);

      const conOpenAi = await errorDeIdInvalido('modelo-de-receta');
      create.mockRejectedValueOnce(conOpenAi);
      await expect(createOpenAiReader(CONFIG).read(LEER)).rejects.toBe(conOpenAi);
    });

    it('R26 — un fallo de conexion se propaga sin reintentar', async () => {
      const { APIConnectionError } = await sdk();
      const original = new APIConnectionError({ message: 'fallo de red' });
      create.mockRejectedValue(original);
      const { createOpenAiReader } = await adaptador();

      await expect(createOpenAiReader(CONFIG).read(LEER)).rejects.toBe(original);
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('la clasificacion de un fallo (R11)', () => {
    it('R11 — cada codigo cae en su tipo; el 404 solo es de modelo si se consultaba uno', async () => {
      const { classifyOpenAiError } = await adaptador();

      expect(classifyOpenAiError(await errorHttp(401), 'm')).toEqual({ kind: 'rejected_key', httpStatus: 401, model: null });
      expect(classifyOpenAiError(await errorHttp(403), 'm')).toEqual({ kind: 'rejected_key', httpStatus: 403, model: null });
      expect(classifyOpenAiError(await errorHttp(402), 'm')).toEqual({ kind: 'quota', httpStatus: 402, model: null });
      expect(classifyOpenAiError(await errorHttp(429), 'm')).toEqual({ kind: 'quota', httpStatus: 429, model: null });
      expect(classifyOpenAiError(await errorHttp(404), 'm')).toEqual({ kind: 'model_unavailable', httpStatus: 404, model: 'm' });
      expect(classifyOpenAiError(await errorHttp(404), null)).toEqual({ kind: 'unexpected', httpStatus: 404, model: null });
      expect(classifyOpenAiError(await errorHttp(500), 'm')).toEqual({ kind: 'unexpected', httpStatus: 500, model: null });
    });

    it('QT-291 R23 — el 400 de id invalido solo es modelo no disponible con OpenRouter, con ese mensaje exacto y ese modelo', async () => {
      const { classifyOpenAiError } = await adaptador();
      const noDisponible = { kind: 'model_unavailable', httpStatus: 400, model: 'm' };
      const inesperado = { kind: 'unexpected', httpStatus: 400, model: null };

      expect(classifyOpenAiError(await errorDeIdInvalido('m'), 'm', 'openrouter')).toEqual(noDisponible);
      expect(classifyOpenAiError(await errorDeIdInvalido('m'), 'm', 'openai')).toEqual(inesperado);
      expect(classifyOpenAiError(await errorDeIdInvalido('m'), 'm')).toEqual(inesperado);
      expect(classifyOpenAiError(await errorDeIdInvalido('m'), null, 'openrouter')).toEqual(inesperado);
      expect(classifyOpenAiError(await errorDeIdInvalido('otro'), 'm', 'openrouter')).toEqual(inesperado);
      expect(classifyOpenAiError(await errorHttp(400), 'm', 'openrouter')).toEqual(inesperado);
      expect(classifyOpenAiError(await errorConMensaje(400, 'Prefijo m is not a valid model ID'), 'm', 'openrouter')).toEqual(inesperado);
      expect(classifyOpenAiError(await errorConMensaje(400, 'm is not a valid model ID.'), 'm', 'openrouter')).toEqual(inesperado);
      expect(classifyOpenAiError(await errorConMensaje(422, 'm is not a valid model ID'), 'm', 'openrouter')).toEqual({
        kind: 'unexpected',
        httpStatus: 422,
        model: null,
      });
    });

    it('R11 — sin respuesta es `unreachable`; lo desconocido, `unexpected`', async () => {
      const { APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } = await sdk();
      const { classifyOpenAiError } = await adaptador();
      const sinRespuesta = { kind: 'unreachable', httpStatus: null, model: null };

      expect(classifyOpenAiError(new APIConnectionError({ message: 'x' }), 'm')).toEqual(sinRespuesta);
      expect(classifyOpenAiError(new APIConnectionTimeoutError(), 'm')).toEqual(sinRespuesta);
      expect(classifyOpenAiError(new APIUserAbortError(), 'm')).toEqual(sinRespuesta);
      expect(classifyOpenAiError(new DOMException('x', 'AbortError'), 'm')).toEqual(sinRespuesta);
      expect(classifyOpenAiError(new Error('otra'), 'm')).toEqual({ kind: 'unexpected', httpStatus: null, model: null });
    });
  });

  describe('la prueba con OpenAI (R10)', () => {
    it('R10 — consulta cada modelo una vez, sin generar texto, sin reintentos y con plazo de 10 s', async () => {
      retrieve.mockResolvedValue({ id: 'x' });
      const { probeOpenAi } = await adaptador();

      const resultado = await probeOpenAi({ apiKey: KEY, models: ['receta', 'catalogo'] });

      expect(resultado.ok).toBe(true);
      expect(resultado.ok && resultado.elapsedMs).toBeGreaterThanOrEqual(0);
      expect((await sdk()).default).toHaveBeenCalledWith({ apiKey: KEY, maxRetries: 0, timeout: 10_000 });
      expect(retrieve.mock.calls.map((llamada) => llamada[0]).sort()).toEqual(['catalogo', 'receta']);
      for (const llamada of retrieve.mock.calls) {
        expect((llamada[1] as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
      }
      expect(create).not.toHaveBeenCalled();
    });

    it('R11 — un 404 da `model_unavailable` con ese modelo; un 401, `rejected_key`', async () => {
      const noEsta = await errorHttp(404);
      retrieve.mockImplementation(async (model: string) => {
        if (model === 'catalogo') throw noEsta;
        return { id: model };
      });
      const { probeOpenAi } = await adaptador();

      expect(await probeOpenAi({ apiKey: KEY, models: ['receta', 'catalogo'] })).toEqual({
        ok: false,
        failure: { kind: 'model_unavailable', httpStatus: 404, model: 'catalogo' },
      });

      retrieve.mockReset();
      retrieve.mockRejectedValue(await errorHttp(401));
      expect(await probeOpenAi({ apiKey: KEY, models: ['receta'] })).toEqual({
        ok: false,
        failure: { kind: 'rejected_key', httpStatus: 401, model: null },
      });
    });
  });

  describe('la prueba con OpenRouter (R10)', () => {
    it('R10 — consulta la propia key y el listado, con la URL base de OpenRouter y sin generar texto', async () => {
      get.mockResolvedValue({ data: {} });
      list.mockReturnValue(listado(['otro/modelo', 'anthropic/receta', 'anthropic/catalogo']));
      const { probeOpenRouter } = await adaptador();

      const resultado = await probeOpenRouter({
        apiKey: KEY,
        models: ['anthropic/receta', 'anthropic/catalogo'],
      });

      expect(resultado.ok).toBe(true);
      expect((await sdk()).default).toHaveBeenCalledWith({
        apiKey: KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        maxRetries: 0,
        timeout: 10_000,
      });
      expect(get).toHaveBeenCalledTimes(1);
      expect(get.mock.calls[0]?.[0]).toBe('/key');
      expect((get.mock.calls[0]?.[1] as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
      expect(list).toHaveBeenCalledTimes(1);
      expect((list.mock.calls[0]?.[0] as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
      expect(create).not.toHaveBeenCalled();
      expect(retrieve).not.toHaveBeenCalled();
    });

    it('R11 — la key rechazada manda aunque el listado (publico) responda', async () => {
      get.mockRejectedValue(await errorHttp(401));
      list.mockReturnValue(listado([]));
      const { probeOpenRouter } = await adaptador();

      expect(await probeOpenRouter({ apiKey: KEY, models: ['anthropic/receta'] })).toEqual({
        ok: false,
        failure: { kind: 'rejected_key', httpStatus: 401, model: null },
      });
    });

    it('R11 — sin saldo (402) en la consulta de la key es `quota`', async () => {
      get.mockRejectedValue(await errorHttp(402));
      list.mockReturnValue(listado(['anthropic/receta']));
      const { probeOpenRouter } = await adaptador();

      expect(await probeOpenRouter({ apiKey: KEY, models: ['anthropic/receta'] })).toEqual({
        ok: false,
        failure: { kind: 'quota', httpStatus: 402, model: null },
      });
    });

    it('R11 — un id ausente del listado es `model_unavailable` con ese id', async () => {
      get.mockResolvedValue({ data: {} });
      list.mockReturnValue(listado(['anthropic/receta']));
      const { probeOpenRouter } = await adaptador();

      expect(
        await probeOpenRouter({ apiKey: KEY, models: ['anthropic/receta', 'anthropic/catalogo'] }),
      ).toEqual({
        ok: false,
        failure: { kind: 'model_unavailable', httpStatus: null, model: 'anthropic/catalogo' },
      });
    });

    it('R11 — si el listado no responde, la prueba es `unreachable`', async () => {
      const { APIConnectionError } = await sdk();
      get.mockResolvedValue({ data: {} });
      list.mockReturnValue(Promise.reject(new APIConnectionError({ message: 'x' })));
      const { probeOpenRouter } = await adaptador();

      expect(await probeOpenRouter({ apiKey: KEY, models: ['anthropic/receta'] })).toEqual({
        ok: false,
        failure: { kind: 'unreachable', httpStatus: null, model: null },
      });
    });
  });
});
