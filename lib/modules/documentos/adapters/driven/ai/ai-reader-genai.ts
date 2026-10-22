import {
  ApiError,
  GoogleGenAI,
  createPartFromBase64,
  createPartFromText,
  createUserContent,
} from '@google/genai';
import type { Part } from '@google/genai';

import { AiProviderError } from '../../../domain/errors';

import { isAccountFailure } from '@/lib/modules/integraciones';

import type { AiDocumentPart, AiReader, AiReadRequest } from '../../../ports/ai-reader';
import type { AiProviderFailure, AiProviderProbeResult } from '@/lib/modules/integraciones';

/**
 * Lectura y prueba de conexión contra Gemini con `@google/genai`. **Único archivo del
 * repositorio que importa la librería**: sustituirla es reescribir este archivo.
 *
 * La key y el modelo llegan por parámetro (son los de la empresa) y el cliente se construye en
 * cada llamada. Sin `retryOptions` la librería no reintenta.
 *
 * Sobre el plazo: `httpOptions.timeout` (en milisegundos) se lo pide a la librería y además se
 * arma un `AbortSignal` propio. El docblock de `abortSignal` en `genai.d.ts` es explícito: abortar
 * es solo del cliente, no cancela la petición en el servicio. La garantía real del plazo de lectura
 * la da el dominio.
 */

const PDF_MIME_TYPE = 'application/pdf';
const IMAGE_MIME_TYPE = 'image/png';
const PROBE_TIMEOUT_MS = 10_000;
// Un 400 cuyo cuerpo trae este motivo es una key inválida; la librería copia el cuerpo de la
// respuesta en `ApiError.message`.
const INVALID_KEY_REASON = 'API_KEY_INVALID';

export type GenaiReaderConfig = { readonly apiKey: string; readonly model: string };

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/** Traduce una parte del puerto a la parte que entiende la libreria. Sin texto propio: solo bytes. */
export function toGenaiPart(part: AiDocumentPart): Part {
  if (part.kind === 'pdf') {
    return createPartFromBase64(toBase64(part.bytes), PDF_MIME_TYPE);
  }
  return createPartFromBase64(toBase64(part.png), IMAGE_MIME_TYPE);
}

/**
 * El cuerpo de la peticion: el prompt que llega por parametro, seguido de las partes
 * traducidas. Exportada para poder probar la traduccion sin llamar a la libreria.
 */
export function buildGenaiContents(request: AiReadRequest) {
  return createUserContent([
    createPartFromText(request.prompt),
    ...request.parts.map(toGenaiPart),
  ]);
}

/**
 * El tipo del fallo por el código HTTP; del cuerpo solo se busca el motivo de key inválida, y
 * nada de él se guarda. Todo lo que no es `ApiError` es que no hubo respuesta: la librería
 * convierte cualquier respuesta de error en `ApiError` y deja pasar tal cual los fallos de `fetch`.
 */
export function classifyGenaiError(error: unknown, model: string | null): AiProviderFailure {
  if (!(error instanceof ApiError)) return { kind: 'unreachable', httpStatus: null, model: null };
  const status = error.status;
  if (status === 401 || status === 403) return { kind: 'rejected_key', httpStatus: status, model: null };
  if (status === 400 && error.message.includes(INVALID_KEY_REASON)) {
    return { kind: 'rejected_key', httpStatus: status, model: null };
  }
  if (status === 402 || status === 429) return { kind: 'quota', httpStatus: status, model: null };
  if (status === 404 && model !== null) return { kind: 'model_unavailable', httpStatus: status, model };
  return { kind: 'unexpected', httpStatus: status, model: null };
}

async function readWithGenai(config: GenaiReaderConfig, request: AiReadRequest): Promise<string> {
  const client = new GoogleGenAI({ apiKey: config.apiKey });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const response = await client.models.generateContent({
      model: config.model,
      contents: buildGenaiContents(request),
      config: {
        httpOptions: { timeout: request.timeoutMs },
        abortSignal: controller.signal,
      },
    });

    const text = response.text;
    if (text === undefined) {
      throw new Error('la lectura con Gemini no devolvio texto en la respuesta');
    }
    return text;
  } catch (error) {
    if (error instanceof ApiError) {
      const failure = classifyGenaiError(error, null);
      if (isAccountFailure(failure)) {
        throw new AiProviderError(failure, `gemini generateContent respondió ${failure.httpStatus}`);
      }
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** `AiReader` con la key y el modelo de la empresa: una sola llamada por lectura, sin reintento. */
export function createGenaiReader(config: GenaiReaderConfig): AiReader {
  return { read: (request) => readWithGenai(config, request) };
}

/**
 * La prueba de la conexión: consulta cada modelo sin generar texto, así no gasta cuota. Los
 * modelos van en paralelo y la prueba entera tiene un solo plazo.
 */
export async function probeGenai(input: {
  readonly apiKey: string;
  readonly models: readonly string[];
}): Promise<AiProviderProbeResult> {
  const client = new GoogleGenAI({ apiKey: input.apiKey });
  const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  const started = Date.now();
  const failures: AiProviderFailure[] = [];

  await Promise.all(
    [...new Set(input.models)].map(async (model) => {
      try {
        await client.models.get({
          model,
          config: { abortSignal: signal, httpOptions: { timeout: PROBE_TIMEOUT_MS } },
        });
      } catch (error) {
        failures.push(classifyGenaiError(error, model));
      }
    }),
  );

  const failure = failures[0];
  return failure === undefined ? { ok: true, elapsedMs: Date.now() - started } : { ok: false, failure };
}
