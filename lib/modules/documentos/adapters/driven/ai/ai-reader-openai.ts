import OpenAI, { APIError } from 'openai';

import { AiProviderError } from '../../../domain/errors';

import { isAccountFailure } from '@/lib/modules/integraciones';

import type { AiDocumentPart, AiReader, AiReadRequest } from '../../../ports/ai-reader';
import type { AiProviderFailure, AiProviderProbeResult } from '@/lib/modules/integraciones';
import type {
  ChatCompletion,
  ChatCompletionContentPart,
} from 'openai/resources/chat/completions';

/**
 * Lectura y prueba de conexión contra OpenAI y OpenRouter con `openai`: OpenRouter habla la misma
 * API con otra URL base. **Único archivo del repositorio que importa la librería**: sustituirla es
 * reescribir este archivo.
 *
 * La key y el modelo llegan por parámetro (son los de la empresa) y el cliente se construye en
 * cada llamada. El SDK reintenta dos veces por defecto; `maxRetries: 0` mantiene una sola llamada.
 * Abortar solo deja de esperar: la garantía real del plazo de lectura la da el dominio.
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const PDF_FILENAME = 'documento.pdf';
const MAX_COMPLETION_TOKENS = 16000;
const PROBE_TIMEOUT_MS = 10_000;

export type OpenAiReaderConfig = {
  readonly apiKey: string;
  readonly model: string;
  readonly baseURL?: string;
};

function toDataUrl(mediaType: string, bytes: Uint8Array): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`;
}

/** Traduce una parte del puerto a la de Chat Completions. Sin texto propio: solo bytes. */
export function toOpenAiPart(part: AiDocumentPart): ChatCompletionContentPart {
  if (part.kind === 'pdf') {
    return {
      type: 'file',
      file: { filename: PDF_FILENAME, file_data: toDataUrl('application/pdf', part.bytes) },
    };
  }
  return { type: 'image_url', image_url: { url: toDataUrl('image/png', part.png) } };
}

/** El contenido del único mensaje de usuario: los adjuntos primero y el prompt al final. */
export function buildOpenAiContent(request: AiReadRequest): ChatCompletionContentPart[] {
  return [...request.parts.map(toOpenAiPart), { type: 'text', text: request.prompt }];
}

/**
 * El texto de la respuesta, o un error si no lo hay. Una negativa o un corte por tokens no son
 * una lectura: devolver el texto parcial haría pasar por buena una lectura incompleta.
 */
export function textFromOpenAiCompletion(completion: ChatCompletion): string {
  const choice = completion.choices[0];
  if (choice === undefined) {
    throw new Error('la lectura con OpenAI no devolvio ninguna respuesta');
  }
  if (choice.message.refusal !== null && choice.message.refusal !== undefined) {
    throw new Error('la lectura con OpenAI fue rechazada por el modelo');
  }
  if (choice.finish_reason === 'length') {
    throw new Error('la lectura con OpenAI se corto al llegar al limite de tokens de salida');
  }
  const text = choice.message.content;
  if (text === null || text === '') {
    throw new Error('la lectura con OpenAI no devolvio texto en la respuesta');
  }
  return text;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/**
 * El tipo del fallo, solo por el código HTTP: el texto del proveedor no se mira ni se guarda.
 * 402 es la falta de saldo de OpenRouter. `model` es el que se consultaba en la prueba; al leer
 * va `null` y un 404 no es de cuenta.
 */
export function classifyOpenAiError(error: unknown, model: string | null): AiProviderFailure {
  if (error instanceof APIError) {
    // Las clases de conexión y de aborto del SDK son `APIError` sin código: no hubo respuesta.
    if (typeof error.status !== 'number') return { kind: 'unreachable', httpStatus: null, model: null };
    const status = error.status;
    if (status === 401 || status === 403) return { kind: 'rejected_key', httpStatus: status, model: null };
    if (status === 402 || status === 429) return { kind: 'quota', httpStatus: status, model: null };
    if (status === 404 && model !== null) return { kind: 'model_unavailable', httpStatus: status, model };
    return { kind: 'unexpected', httpStatus: status, model: null };
  }
  if (isAbort(error)) return { kind: 'unreachable', httpStatus: null, model: null };
  return { kind: 'unexpected', httpStatus: null, model: null };
}

function providerLabel(baseURL: string | undefined): string {
  return baseURL === OPENROUTER_BASE_URL ? 'openrouter' : 'openai';
}

async function readWithOpenAi(config: OpenAiReaderConfig, request: AiReadRequest): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL === undefined ? {} : { baseURL: config.baseURL }),
    maxRetries: 0,
    timeout: request.timeoutMs,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const completion = await client.chat.completions.create(
      {
        model: config.model,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        messages: [{ role: 'user', content: buildOpenAiContent(request) }],
      },
      { signal: controller.signal },
    );
    return textFromOpenAiCompletion(completion);
  } catch (error) {
    const failure = classifyOpenAiError(error, null);
    if (isAccountFailure(failure)) {
      throw new AiProviderError(
        failure,
        `${providerLabel(config.baseURL)} chat.completions.create respondió ${failure.httpStatus}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** `AiReader` con la key y el modelo de la empresa: una sola llamada por lectura, sin reintento. */
export function createOpenAiReader(config: OpenAiReaderConfig): AiReader {
  return { read: (request) => readWithOpenAi(config, request) };
}

type ProbeInput = { readonly apiKey: string; readonly models: readonly string[] };

function probeResult(started: number, failures: readonly AiProviderFailure[]): AiProviderProbeResult {
  const failure = failures[0];
  return failure === undefined ? { ok: true, elapsedMs: Date.now() - started } : { ok: false, failure };
}

/**
 * La prueba con OpenAI: consulta cada modelo sin generar texto, así no gasta cuota. Los modelos
 * van en paralelo y la prueba entera tiene un solo plazo.
 */
export async function probeOpenAi(input: ProbeInput): Promise<AiProviderProbeResult> {
  const client = new OpenAI({ apiKey: input.apiKey, maxRetries: 0, timeout: PROBE_TIMEOUT_MS });
  const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  const started = Date.now();
  const failures: AiProviderFailure[] = [];

  await Promise.all(
    [...new Set(input.models)].map(async (model) => {
      try {
        await client.models.retrieve(model, { signal });
      } catch (error) {
        failures.push(classifyOpenAiError(error, model));
      }
    }),
  );

  return probeResult(started, failures);
}

/**
 * La prueba con OpenRouter: su listado de modelos es público y no valida la key, así que la key
 * se valida con la consulta de la propia key y los modelos se buscan en el listado.
 */
export async function probeOpenRouter(input: ProbeInput): Promise<AiProviderProbeResult> {
  const client = new OpenAI({
    apiKey: input.apiKey,
    baseURL: OPENROUTER_BASE_URL,
    maxRetries: 0,
    timeout: PROBE_TIMEOUT_MS,
  });
  const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  const started = Date.now();

  // Sin parámetros de paginación el listado viene entero.
  const [keyFailure, listing] = await Promise.all([
    client.get('/key', { signal }).then(
      () => null,
      (error: unknown) => classifyOpenAiError(error, null),
    ),
    client.models.list({ signal }).then(
      (page) => ({ ok: true as const, ids: new Set(page.data.map((entry) => entry.id)) }),
      (error: unknown) => ({ ok: false as const, failure: classifyOpenAiError(error, null) }),
    ),
  ]);

  if (keyFailure !== null) return { ok: false, failure: keyFailure };
  if (!listing.ok) return { ok: false, failure: listing.failure };
  const missing = input.models.find((model) => !listing.ids.has(model));
  if (missing !== undefined) {
    return { ok: false, failure: { kind: 'model_unavailable', httpStatus: null, model: missing } };
  }
  return { ok: true, elapsedMs: Date.now() - started };
}
