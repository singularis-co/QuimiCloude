// El adaptador `@anthropic-ai/sdk`: la lectura con la key y el modelo de la empresa, la prueba de
// la conexion y la clasificacion de sus fallos.
//
// Ningun caso de este archivo toca la red: el cliente se dobla con `vi.mock` y las clases de error
// son las REALES de la libreria, para que la clasificacion se pruebe contra lo que el SDK lanza.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiProviderError } from '@/lib/modules/documentos/domain/errors';

const create = vi.fn();
const retrieve = vi.fn();

class AnthropicDouble {
  messages = { create };
  models = { retrieve };
}

vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const real = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  return { ...real, default: vi.fn(AnthropicDouble) };
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const ADAPTADOR = 'lib/modules/documentos/adapters/driven/ai/ai-reader-anthropic.ts';
const KEY = 'sk-ant-CLAVE-RECONOCIBLE';
const CONFIG = { apiKey: KEY, model: 'modelo-de-receta' };

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

function importaAnthropic(source: string): boolean {
  return /from\s+['"]@anthropic-ai\/sdk(\/[^'"]*)?['"]|require\(\s*['"]@anthropic-ai\/sdk(\/[^'"]*)?['"]\s*\)|import\(\s*['"]@anthropic-ai\/sdk(\/[^'"]*)?['"]\s*\)/.test(
    fuenteSinComentarios(source),
  );
}

function mensaje(overrides: Record<string, unknown>) {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'modelo-de-receta',
    content: [],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    ...overrides,
  };
}

async function adaptador() {
  return import('@/lib/modules/documentos/adapters/driven/ai/ai-reader-anthropic');
}

async function sdk() {
  return import('@anthropic-ai/sdk');
}

/** Un `APIError` real del SDK con ese codigo y un cuerpo que delata cualquier fuga. */
async function errorHttp(status: number) {
  const { APIError } = await sdk();
  return APIError.generate(status, { error: { message: `cuerpo con ${KEY}` } }, `fallo ${KEY}`, new Headers());
}

const LEER = { prompt: 'x', parts: [], timeoutMs: 1000 } as const;

describe('documentos — el adaptador de Claude (@anthropic-ai/sdk)', () => {
  afterEach(async () => {
    create.mockReset();
    retrieve.mockReset();
    vi.mocked((await sdk()).default).mockClear();
  });

  describe('la libreria vive en un solo archivo de produccion', () => {
    const ARBOL_VIGILADO = ['lib', 'app', 'components', 'scripts'];

    it('un unico archivo de produccion importa @anthropic-ai/sdk, y es el adaptador', () => {
      const fuentes = ARBOL_VIGILADO.flatMap((dir) => archivosDe(join(repoRoot, dir)));
      expect(fuentes.length).toBeGreaterThan(100);
      const importadores = fuentes
        .filter((abs) => importaAnthropic(readFileSync(abs, 'utf8')))
        .map((abs) => toPosix(relative(repoRoot, abs)))
        .sort();

      expect(importadores).toEqual([ADAPTADOR]);
    });

    it('el detector dispara con un import y no con un comentario', () => {
      expect(importaAnthropic("import Anthropic from '@anthropic-ai/sdk';")).toBe(true);
      expect(importaAnthropic("import type { X } from '@anthropic-ai/sdk/resources';")).toBe(true);
      expect(importaAnthropic('// se nombra @anthropic-ai/sdk en un comentario')).toBe(false);
    });
  });

  describe('la config llega por parametro (R22)', () => {
    it('R22 — el adaptador no lee ninguna variable de entorno', () => {
      const fuente = fuenteSinComentarios(readFileSync(join(repoRoot, ADAPTADOR), 'utf8'));
      expect(fuente).not.toMatch(/process\.env/);
      expect(fuente).not.toMatch(/ANTHROPIC_/);
    });

    it('R22 — importar el adaptador no construye cliente ni llama a la libreria', async () => {
      const modulo = await adaptador();
      expect(typeof modulo.createAnthropicReader).toBe('function');
      expect((await sdk()).default).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('R22 — cada lector usa SU key y SU modelo: dos empresas no se mezclan', async () => {
      create.mockResolvedValue(mensaje({ content: [{ type: 'text', text: 'ok' }] }));
      const { createAnthropicReader } = await adaptador();

      await createAnthropicReader({ apiKey: 'key-a', model: 'modelo-a' }).read(LEER);
      await createAnthropicReader({ apiKey: 'key-b', model: 'modelo-b' }).read(LEER);

      const constructor = (await sdk()).default;
      expect(constructor).toHaveBeenNthCalledWith(1, { apiKey: 'key-a', maxRetries: 0, timeout: 1000 });
      expect(constructor).toHaveBeenNthCalledWith(2, { apiKey: 'key-b', maxRetries: 0, timeout: 1000 });
      expect(create.mock.calls.map((llamada) => (llamada[0] as { model: string }).model)).toEqual([
        'modelo-a',
        'modelo-b',
      ]);
    });
  });

  describe('la lectura, con el cliente doblado', () => {
    it('el doble reemplaza a la libreria: cliente sin reintentos y con el plazo de la peticion', async () => {
      create.mockResolvedValue(mensaje({ content: [{ type: 'text', text: 'ok' }] }));
      const { createAnthropicReader } = await adaptador();

      await createAnthropicReader(CONFIG).read({ prompt: 'x', parts: [], timeoutMs: 4321 });

      const constructor = (await sdk()).default;
      expect(vi.isMockFunction(constructor)).toBe(true);
      expect(constructor).toHaveBeenCalledWith({ apiKey: KEY, maxRetries: 0, timeout: 4321 });
    });

    it('una sola llamada con el modelo dado, el contenido traducido y una senal de aborto', async () => {
      create.mockResolvedValue(mensaje({ content: [{ type: 'text', text: 'ok' }] }));
      const { createAnthropicReader } = await adaptador();

      await createAnthropicReader(CONFIG).read({
        prompt: 'lee el documento',
        parts: [{ kind: 'pdf', bytes: new Uint8Array([1, 2, 3]) }],
        timeoutMs: 5000,
      });

      expect(create).toHaveBeenCalledTimes(1);
      const [cuerpo, opciones] = create.mock.calls[0] as [Record<string, unknown>, { signal: AbortSignal }];
      expect(cuerpo.model).toBe('modelo-de-receta');
      expect(cuerpo.max_tokens).toBe(16000);
      expect(cuerpo.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: 'AQID' },
            },
            { type: 'text', text: 'lee el documento' },
          ],
        },
      ]);
      expect(opciones.signal).toBeInstanceOf(AbortSignal);
    });

    it('no envia thinking, temperature, top_p ni un turno de asistente prefijado', async () => {
      create.mockResolvedValue(mensaje({ content: [{ type: 'text', text: 'ok' }] }));
      const { createAnthropicReader } = await adaptador();

      await createAnthropicReader(CONFIG).read(LEER);

      const cuerpo = create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(Object.keys(cuerpo).sort()).toEqual(['max_tokens', 'messages', 'model']);
      const mensajes = cuerpo.messages as { role: string }[];
      expect(mensajes.map((m) => m.role)).toEqual(['user']);
    });

    it('devuelve el texto tal cual, concatenando solo los bloques de texto', async () => {
      create.mockResolvedValue(
        mensaje({
          content: [
            { type: 'text', text: '  Texto  con espacios ' },
            { type: 'tool_use', id: 't', name: 'n', input: {} },
            { type: 'text', text: 'raros.\n\n' },
          ],
        }),
      );
      const { createAnthropicReader } = await adaptador();

      expect(await createAnthropicReader(CONFIG).read(LEER)).toBe('  Texto  con espacios raros.\n\n');
    });

    it('si la respuesta no trae texto, lanza nombrando al proveedor', async () => {
      create.mockResolvedValue(mensaje({ content: [] }));
      const { createAnthropicReader } = await adaptador();

      await expect(createAnthropicReader(CONFIG).read(LEER)).rejects.toThrowError(/claude/i);
    });

    it('una negativa del modelo lanza, y el error no vuelca el contenido', async () => {
      create.mockResolvedValue(
        mensaje({ stop_reason: 'refusal', content: [{ type: 'text', text: 'CONTENIDO-RECONOCIBLE' }] }),
      );
      const { createAnthropicReader } = await adaptador();

      const error = await createAnthropicReader(CONFIG).read(LEER).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(AiProviderError);
      expect((error as Error).message).toMatch(/rechazada/);
      expect((error as Error).message).not.toContain('CONTENIDO-RECONOCIBLE');
    });

    it('un corte por max_tokens lanza en vez de devolver una lectura incompleta', async () => {
      create.mockResolvedValue(
        mensaje({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'a medias' }] }),
      );
      const { createAnthropicReader } = await adaptador();

      await expect(createAnthropicReader(CONFIG).read(LEER)).rejects.toThrowError(/limite de tokens/);
    });
  });

  describe('un fallo de cuenta al leer es `AiProviderError`; el resto, el error de siempre (R25, R26)', () => {
    it.each([
      [401, 'rejected_key'],
      [403, 'rejected_key'],
      [429, 'quota'],
    ] as const)('R25 — %i al leer lanza AiProviderError (%s) sin la key ni el cuerpo', async (status, kind) => {
      create.mockRejectedValue(await errorHttp(status));
      const { createAnthropicReader } = await adaptador();

      const error = await createAnthropicReader(CONFIG).read(LEER).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AiProviderError);
      const deCuenta = error as AiProviderError;
      expect(deCuenta.code).toBe('ai_provider_error');
      expect(deCuenta.failure).toEqual({ kind, httpStatus: status, model: null });
      expect(deCuenta.diagnostic).toBe(`claude messages.create respondió ${status}`);
      expect(JSON.stringify({ m: deCuenta.message, d: deCuenta.diagnostic })).not.toContain(KEY);
      expect(create).toHaveBeenCalledTimes(1);
    });

    it.each([404, 500, 400])('R26 — %i al leer se propaga tal cual, sin AiProviderError', async (status) => {
      const original = await errorHttp(status);
      create.mockRejectedValue(original);
      const { createAnthropicReader } = await adaptador();

      await expect(createAnthropicReader(CONFIG).read(LEER)).rejects.toBe(original);
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('R26 — un fallo de red se propaga sin reintentar', async () => {
      const { APIConnectionError } = await sdk();
      const original = new APIConnectionError({ message: 'fallo de red' });
      create.mockRejectedValue(original);
      const { createAnthropicReader } = await adaptador();

      await expect(createAnthropicReader(CONFIG).read(LEER)).rejects.toBe(original);
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('la clasificacion de un fallo (R11, R25, R26)', () => {
    it('R11 — cada codigo cae en su tipo; el 404 solo es de modelo si se consultaba uno', async () => {
      const { classifyAnthropicError } = await adaptador();

      expect(classifyAnthropicError(await errorHttp(401), 'm')).toEqual({ kind: 'rejected_key', httpStatus: 401, model: null });
      expect(classifyAnthropicError(await errorHttp(403), 'm')).toEqual({ kind: 'rejected_key', httpStatus: 403, model: null });
      expect(classifyAnthropicError(await errorHttp(429), 'm')).toEqual({ kind: 'quota', httpStatus: 429, model: null });
      expect(classifyAnthropicError(await errorHttp(404), 'm')).toEqual({ kind: 'model_unavailable', httpStatus: 404, model: 'm' });
      expect(classifyAnthropicError(await errorHttp(404), null)).toEqual({ kind: 'unexpected', httpStatus: 404, model: null });
      expect(classifyAnthropicError(await errorHttp(500), 'm')).toEqual({ kind: 'unexpected', httpStatus: 500, model: null });
      expect(classifyAnthropicError(await errorHttp(402), 'm')).toEqual({ kind: 'unexpected', httpStatus: 402, model: null });
    });

    it('R11 — sin respuesta (conexion, plazo o aborto) es `unreachable`; lo desconocido, `unexpected`', async () => {
      const { APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } = await sdk();
      const { classifyAnthropicError } = await adaptador();
      const sinRespuesta = { kind: 'unreachable', httpStatus: null, model: null };

      expect(classifyAnthropicError(new APIConnectionError({ message: 'x' }), 'm')).toEqual(sinRespuesta);
      expect(classifyAnthropicError(new APIConnectionTimeoutError(), 'm')).toEqual(sinRespuesta);
      expect(classifyAnthropicError(new APIUserAbortError(), 'm')).toEqual(sinRespuesta);
      expect(classifyAnthropicError(new DOMException('x', 'TimeoutError'), 'm')).toEqual(sinRespuesta);
      expect(classifyAnthropicError(new Error('otra cosa'), 'm')).toEqual({
        kind: 'unexpected',
        httpStatus: null,
        model: null,
      });
    });
  });

  describe('la prueba de la conexion (R10)', () => {
    it('R10 — consulta cada modelo una vez, sin generar texto, sin reintentos y con plazo de 10 s', async () => {
      retrieve.mockResolvedValue({ id: 'x' });
      const { probeAnthropic } = await adaptador();

      const resultado = await probeAnthropic({ apiKey: KEY, models: ['receta', 'catalogo'] });

      expect(resultado.ok).toBe(true);
      expect(resultado.ok && resultado.elapsedMs).toBeGreaterThanOrEqual(0);
      expect((await sdk()).default).toHaveBeenCalledWith({ apiKey: KEY, maxRetries: 0, timeout: 10_000 });
      expect(retrieve.mock.calls.map((llamada) => llamada[0]).sort()).toEqual(['catalogo', 'receta']);
      for (const llamada of retrieve.mock.calls) {
        expect((llamada[2] as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
      }
      expect(create).not.toHaveBeenCalled();
    });

    it('R10 — si receta y catalogo son el mismo modelo, se consulta una sola vez', async () => {
      retrieve.mockResolvedValue({ id: 'x' });
      const { probeAnthropic } = await adaptador();

      await probeAnthropic({ apiKey: KEY, models: ['mismo', 'mismo'] });

      expect(retrieve).toHaveBeenCalledTimes(1);
    });

    it('R11 — un 404 en el segundo modelo da `model_unavailable` con ESE modelo', async () => {
      const noEsta = await errorHttp(404);
      retrieve.mockImplementation(async (model: string) => {
        if (model === 'catalogo') throw noEsta;
        return { id: model };
      });
      const { probeAnthropic } = await adaptador();

      expect(await probeAnthropic({ apiKey: KEY, models: ['receta', 'catalogo'] })).toEqual({
        ok: false,
        failure: { kind: 'model_unavailable', httpStatus: 404, model: 'catalogo' },
      });
    });

    it('R11 — una key rechazada da `rejected_key` con su codigo', async () => {
      retrieve.mockRejectedValue(await errorHttp(401));
      const { probeAnthropic } = await adaptador();

      expect(await probeAnthropic({ apiKey: KEY, models: ['receta'] })).toEqual({
        ok: false,
        failure: { kind: 'rejected_key', httpStatus: 401, model: null },
      });
    });
  });

  describe('la traduccion de partes es pura y se prueba en memoria', () => {
    it('un PDF se traduce a un bloque document en base64 con application/pdf', async () => {
      const { toAnthropicBlock } = await adaptador();

      expect(toAnthropicBlock({ kind: 'pdf', bytes: new Uint8Array([1, 2, 3]) })).toEqual({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'AQID' },
      });
    });

    it('una imagen se traduce a un bloque image en base64 con image/png', async () => {
      const { toAnthropicBlock } = await adaptador();

      expect(toAnthropicBlock({ kind: 'image', png: new Uint8Array([9, 9]), pageNumber: 1 })).toEqual({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: Buffer.from([9, 9]).toString('base64') },
      });
    });

    it('el base64 no lleva saltos de linea aunque el adjunto sea grande', async () => {
      const { toAnthropicBlock } = await adaptador();

      const bloque = toAnthropicBlock({ kind: 'pdf', bytes: new Uint8Array(100_000).fill(7) }) as {
        source: { data: string };
      };

      expect(bloque.source.data).not.toMatch(/\s/);
    });

    it('los adjuntos van antes del prompt, en orden, y el prompt llega tal cual', async () => {
      const { buildAnthropicContent } = await adaptador();

      const contenido = buildAnthropicContent({
        prompt: 'un prompt cualquiera que llega por parametro',
        parts: [
          { kind: 'image', png: new Uint8Array([1]), pageNumber: 1 },
          { kind: 'image', png: new Uint8Array([2]), pageNumber: 2 },
        ],
        timeoutMs: 1000,
      });

      expect(contenido.map((bloque) => bloque.type)).toEqual(['image', 'image', 'text']);
      expect(contenido[2]).toEqual({ type: 'text', text: 'un prompt cualquiera que llega por parametro' });
    });
  });
});
