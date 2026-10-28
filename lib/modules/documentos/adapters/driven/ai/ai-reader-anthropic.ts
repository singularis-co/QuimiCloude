import Anthropic, { APIError } from '@anthropic-ai/sdk';

import { AiProviderError } from '../../../domain/errors';

import { marksConnection } from '@/lib/modules/integraciones';

import type { AiDocumentPart, AiReader, AiReadRequest } from '../../../ports/ai-reader';
import type { AiProviderFailure, AiProviderProbeResult } from '@/lib/modules/integraciones';

/**
 * Lectura y prueba de conexión contra Claude con `@anthropic-ai/sdk`. **Único archivo del
 * repositorio que importa la librería**: sustituirla es reescribir este archivo.
 *
 * La key y el modelo llegan por parámetro (son los de la empresa) y el cliente se construye en
 * cada llamada. El SDK reintenta dos veces por defecto; `maxRetries: 0` mantiene una sola llamada.
 * Abortar solo deja de esperar: la garantía real del plazo de lectura la da el dominio.
 *
 * No se envían `thinking`, `temperature`, `top_p` ni prefill: varios modelos actuales los
 * rechazan con un 400.
 */

const PDF_MEDIA_TYPE = 'application/pdf';
const IMAGE_MEDIA_TYPE = 'image/png';
const MAX_TOKENS = 16000;
const PROBE_TIMEOUT_MS = 10_000;

export type AnthropicReaderConfig = { readonly apiKey: string; readonly model: string };

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/** Traduce una parte del puerto al bloque que entiende la libreria. Sin texto propio: solo bytes. */
export function toAnthropicBlock(part: AiDocumentPart): Anthropic.ContentBlockParam {
  if (part.kind === 'pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: PDF_MEDIA_TYPE, data: toBase64(part.bytes) },
    };
  }
  return {
    type: 'image',
    source: { type: 'base64', media_type: IMAGE_MEDIA_TYPE, data: toBase64(part.png) },
  };
}

/**
 * El contenido del unico mensaje de usuario: los adjuntos primero y el prompt recibido por
 * parametro al final. Exportada para poder probar la traduccion sin llamar a la libreria.
 */
export function buildAnthropicContent(request: AiReadRequest): Anthropic.ContentBlockParam[] {
  return [...request.parts.map(toAnthropicBlock), { type: 'text', text: request.prompt }];
}

/**
 * El texto de la respuesta, o un error si no lo hay. Una negativa o un corte por tokens no
 * son una lectura: devolver el texto parcial haria pasar por buena una lectura incompleta.
 */
export function textFromAnthropicMessage(message: Anthropic.Message): string {
  if (message.stop_reason === 'refusal') {
    throw new Error('la lectura con Claude fue rechazada por el modelo');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('la lectura con Claude se corto al llegar al limite de tokens de salida');
  }

  const textos: string[] = [];
  for (const block of message.content) {
    if (block.type === 'text') textos.push(block.text);
  }
  if (textos.length === 0) {
    throw new Error('la lectura con Claude no devolvio texto en la respuesta');
  }
  return textos.join('');
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/**
 * El tipo del fallo, solo por el código HTTP: el texto del proveedor no se mira ni se guarda.
 * `model` es el que se consultaba o con el que se leía; sin él, un 404 no es de modelo.
 */
export function classifyAnthropicError(error: unknown, model: string | null): AiProviderFailure {
  if (error instanceof APIError) {
    // Las clases de conexión y de aborto del SDK son `APIError` sin código: no hubo respuesta.
    if (typeof error.status !== 'number') return { kind: 'unreachable', httpStatus: null, model: null };
    const status = error.status;
    if (status === 401 || status === 403) return { kind: 'rejected_key', httpStatus: status, model: null };
    if (status === 429) return { kind: 'quota', httpStatus: status, model: null };
    if (status === 404 && model !== null) return { kind: 'model_unavailable', httpStatus: status, model };
    return { kind: 'unexpected', httpStatus: status, model: null };
  }
  if (isAbort(error)) return { kind: 'unreachable', httpStatus: null, model: null };
  return { kind: 'unexpected', httpStatus: null, model: null };
}

async function readWithAnthropic(config: AnthropicReaderConfig, request: AiReadRequest): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 0, timeout: request.timeoutMs });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const message = await client.messages.create(
      {
        model: config.model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: buildAnthropicContent(request) }],
      },
      { signal: controller.signal },
    );
    return textFromAnthropicMessage(message);
  } catch (error) {
    const failure = classifyAnthropicError(error, config.model);
    if (marksConnection(failure)) {
      throw new AiProviderError(failure, `claude messages.create respondió ${failure.httpStatus}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** `AiReader` con la key y el modelo de la empresa: una sola llamada por lectura, sin reintento. */
export function createAnthropicReader(config: AnthropicReaderConfig): AiReader {
  return { read: (request) => readWithAnthropic(config, request) };
}

/**
 * La prueba de la conexión: consulta cada modelo sin generar texto, así no gasta cuota. Los
 * modelos van en paralelo y la prueba entera tiene un solo plazo.
 */
export async function probeAnthropic(input: {
  readonly apiKey: string;
  readonly models: readonly string[];
}): Promise<AiProviderProbeResult> {
  const client = new Anthropic({ apiKey: input.apiKey, maxRetries: 0, timeout: PROBE_TIMEOUT_MS });
  const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  const started = Date.now();
  const failures: AiProviderFailure[] = [];

  await Promise.all(
    [...new Set(input.models)].map(async (model) => {
      try {
        await client.models.retrieve(model, {}, { signal });
      } catch (error) {
        failures.push(classifyAnthropicError(error, model));
      }
    }),
  );

  const failure = failures[0];
  return failure === undefined ? { ok: true, elapsedMs: Date.now() - started } : { ok: false, failure };
}
