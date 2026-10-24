import { z } from 'zod';

import { readGraphApiVersion } from '../config/whatsapp-config-env';

import type { GraphFailure } from '../../../domain/graph-failure';
import type {
  GraphMediaDownload,
  GraphMessageSent,
  GraphOutboundMessage,
  GraphProbeResult,
  GraphTemplateCreated,
  GraphTemplateDeleted,
  GraphTemplatePage,
  WhatsappGraphClient,
} from '../../../ports/whatsapp-graph-client';

/** La base no cambia entre entornos; lo que cambia, la versión, va por variable. */
const GRAPH_BASE_URL = 'https://graph.facebook.com';
const PHONE_NUMBER_FIELDS = 'display_phone_number,verified_name';
const TEMPLATE_FIELDS = 'id,name,language,status,category,components,rejected_reason';
const TEMPLATE_PAGE_LIMIT = 100;
const GRAPH_TIMEOUT_MS = 10_000;
/** Meta sirve los archivos de los medios desde este dominio; a otro host no va el token. */
const MEDIA_HOST_SUFFIX = '.fbsbx.com';

const phoneNumberBody = z.object({
  display_phone_number: z.string(),
  verified_name: z.string(),
});

const graphErrorBody = z.object({
  error: z.object({ message: z.string() }),
});

const templateErrorBody = z.object({
  error: z.object({
    message: z.string().optional(),
    code: z.number().int().optional(),
    error_subcode: z.number().int().optional(),
  }),
});

const createdTemplateBody = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  category: z.string().optional(),
});

const templatePageBody = z.object({
  data: z.array(z.unknown()),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).optional(),
      next: z.string().optional(),
    })
    .optional(),
});

const deletedTemplateBody = z.object({ success: z.literal(true) });

const sentMessageBody = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

const mediaMetadataBody = z.object({
  url: z.url(),
  mime_type: z.string(),
  file_size: z.number().int().optional(),
});

type TemplateFailure = { readonly ok: false } & GraphFailure;

const UNREACHABLE: GraphProbeResult = { ok: false, kind: 'unreachable', message: null };
const REJECTED_WITHOUT_MESSAGE: GraphProbeResult = { ok: false, kind: 'rejected', message: null };
const TEMPLATE_UNREACHABLE: TemplateFailure = {
  ok: false,
  kind: 'unreachable',
  message: null,
  code: null,
  subcode: null,
};
const TEMPLATE_REJECTED_WITHOUT_DETAIL: TemplateFailure = {
  ok: false,
  kind: 'rejected',
  message: null,
  code: null,
  subcode: null,
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type GraphReply =
  | { readonly reached: true; readonly status: number; readonly body: unknown }
  | { readonly reached: false };

/**
 * El token va solo en la cabecera: una URL acaba en logs de proxies y de errores. Nada de aquí
 * registra la URL, la cabecera ni el cuerpo.
 */
async function callGraph(
  url: string,
  method: 'GET' | 'POST' | 'DELETE',
  accessToken: string,
  jsonBody?: unknown,
): Promise<GraphReply> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (jsonBody !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
      cache: 'no-store',
    });
    const text = await response.text();
    return { reached: true, status: response.status, body: parseJson(text) };
  } catch {
    return { reached: false };
  }
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

/** Si falta la versión, lanza antes de llamar. */
async function fetchPhoneNumber(input: {
  readonly phoneNumberId: string;
  readonly accessToken: string;
}): Promise<GraphProbeResult> {
  const version = readGraphApiVersion();
  const url =
    `${GRAPH_BASE_URL}/${version}/${encodeURIComponent(input.phoneNumberId)}` +
    `?fields=${PHONE_NUMBER_FIELDS}`;

  const reply = await callGraph(url, 'GET', input.accessToken);
  if (!reply.reached) return UNREACHABLE;

  if (isSuccess(reply.status)) {
    const parsed = phoneNumberBody.safeParse(reply.body);
    if (!parsed.success) return REJECTED_WITHOUT_MESSAGE;
    return {
      ok: true,
      phone: {
        displayPhoneNumber: parsed.data.display_phone_number,
        verifiedName: parsed.data.verified_name,
      },
    };
  }

  const failure = graphErrorBody.safeParse(reply.body);
  return failure.success
    ? { ok: false, kind: 'rejected', message: failure.data.error.message }
    : REJECTED_WITHOUT_MESSAGE;
}

/** Un 5xx es Meta caída, no un rechazo. */
function templateFailureOf(reply: GraphReply): TemplateFailure {
  if (!reply.reached || reply.status >= 500) return TEMPLATE_UNREACHABLE;
  const parsed = templateErrorBody.safeParse(reply.body);
  if (!parsed.success) return TEMPLATE_REJECTED_WITHOUT_DETAIL;
  return {
    ok: false,
    kind: 'rejected',
    message: parsed.data.error.message ?? null,
    code: parsed.data.error.code ?? null,
    subcode: parsed.data.error.error_subcode ?? null,
  };
}

function templatesUrl(wabaId: string): string {
  return `${GRAPH_BASE_URL}/${readGraphApiVersion()}/${encodeURIComponent(wabaId)}/message_templates`;
}

async function createTemplate(input: {
  readonly wabaId: string;
  readonly accessToken: string;
  readonly name: string;
  readonly language: string;
  readonly category: string;
  readonly components: readonly unknown[];
}): Promise<GraphTemplateCreated> {
  const reply = await callGraph(templatesUrl(input.wabaId), 'POST', input.accessToken, {
    name: input.name,
    language: input.language,
    category: input.category,
    components: input.components,
  });
  if (!reply.reached || !isSuccess(reply.status)) return templateFailureOf(reply);
  const parsed = createdTemplateBody.safeParse(reply.body);
  if (!parsed.success) return TEMPLATE_REJECTED_WITHOUT_DETAIL;
  return {
    ok: true,
    id: parsed.data.id,
    status: parsed.data.status ?? null,
    category: parsed.data.category ?? null,
  };
}

/**
 * La página siguiente se pide con `after` y no siguiendo `paging.next`: esa URL la arma Meta y
 * puede traer parámetros que no controlamos. Un `next` sin cursor se rechaza: cortar ahí dejaría
 * la lista a medias y la sincronización borraría lo que falta.
 */
async function listTemplatesPage(input: {
  readonly wabaId: string;
  readonly accessToken: string;
  readonly after: string | null;
}): Promise<GraphTemplatePage> {
  const cursor = input.after === null ? '' : `&after=${encodeURIComponent(input.after)}`;
  const url =
    `${templatesUrl(input.wabaId)}?fields=${TEMPLATE_FIELDS}` +
    `&limit=${String(TEMPLATE_PAGE_LIMIT)}${cursor}`;
  const reply = await callGraph(url, 'GET', input.accessToken);
  if (!reply.reached || !isSuccess(reply.status)) return templateFailureOf(reply);
  const parsed = templatePageBody.safeParse(reply.body);
  if (!parsed.success) return TEMPLATE_REJECTED_WITHOUT_DETAIL;
  const paging = parsed.data.paging;
  if (paging?.next === undefined) return { ok: true, items: parsed.data.data, next: null };
  const after = paging.cursors?.after;
  if (after === undefined || after === '') return TEMPLATE_REJECTED_WITHOUT_DETAIL;
  return { ok: true, items: parsed.data.data, next: after };
}

async function deleteTemplate(input: {
  readonly wabaId: string;
  readonly accessToken: string;
  readonly hsmId: string;
  readonly name: string;
}): Promise<GraphTemplateDeleted> {
  const url =
    `${templatesUrl(input.wabaId)}?hsm_id=${encodeURIComponent(input.hsmId)}` +
    `&name=${encodeURIComponent(input.name)}`;
  const reply = await callGraph(url, 'DELETE', input.accessToken);
  if (!reply.reached || !isSuccess(reply.status)) return templateFailureOf(reply);
  return deletedTemplateBody.safeParse(reply.body).success ? { ok: true } : TEMPLATE_REJECTED_WITHOUT_DETAIL;
}

function outboundBodyOf(to: string, message: GraphOutboundMessage): Record<string, unknown> {
  const envelope = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
  if (message.type === 'text') {
    return { ...envelope, type: 'text', text: { body: message.body, preview_url: false } };
  }
  return {
    ...envelope,
    type: 'template',
    template: { name: message.name, language: { code: message.language }, components: message.components },
  };
}

async function sendMessage(input: {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly to: string;
  readonly message: GraphOutboundMessage;
}): Promise<GraphMessageSent> {
  const url = `${GRAPH_BASE_URL}/${readGraphApiVersion()}/${encodeURIComponent(input.phoneNumberId)}/messages`;
  const reply = await callGraph(url, 'POST', input.accessToken, outboundBodyOf(input.to, input.message));
  if (!reply.reached || !isSuccess(reply.status)) return templateFailureOf(reply);
  const parsed = sentMessageBody.safeParse(reply.body);
  const first = parsed.success ? parsed.data.messages[0] : undefined;
  return first === undefined ? TEMPLATE_UNREACHABLE : { ok: true, wamid: first.id };
}

function isMetaMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith(MEDIA_HOST_SUFFIX);
  } catch {
    return false;
  }
}

function mediaTypeOf(header: string | null): string | null {
  const type = (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return type === '' ? null : type;
}

function declaredLengthOf(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header.trim())) return null;
  const length = Number(header.trim());
  return Number.isSafeInteger(length) ? length : null;
}

/** Defensa si la cabecera miente: el stream se corta con error en cuanto pasa del tope. */
function cappedBody(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) {
          controller.error(new Error('El archivo del medio supera el tamaño máximo.'));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // El cuerpo descartado no importa: el resultado ya está decidido.
  }
}

/**
 * Dos pasos: Graph da la URL del archivo y luego se descarga el binario. La URL de Meta lleva
 * firma y no se registra en ningún sitio. `redirect: 'manual'` impide que una redirección lleve el
 * token a otro host: una respuesta 3xx es un rechazo.
 */
async function downloadMedia(input: {
  readonly mediaId: string;
  readonly accessToken: string;
  readonly maxBytes: number;
}): Promise<GraphMediaDownload> {
  const metadataUrl = `${GRAPH_BASE_URL}/${readGraphApiVersion()}/${encodeURIComponent(input.mediaId)}`;
  const reply = await callGraph(metadataUrl, 'GET', input.accessToken);
  if (!reply.reached || !isSuccess(reply.status)) return templateFailureOf(reply);
  const metadata = mediaMetadataBody.safeParse(reply.body);
  if (!metadata.success) return TEMPLATE_REJECTED_WITHOUT_DETAIL;
  const { url, mime_type: mimeType, file_size: fileSize } = metadata.data;
  if (fileSize !== undefined && fileSize > input.maxBytes) return TEMPLATE_REJECTED_WITHOUT_DETAIL;
  if (!isMetaMediaUrl(url)) return TEMPLATE_REJECTED_WITHOUT_DETAIL;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${input.accessToken}` },
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return TEMPLATE_UNREACHABLE;
  }

  if (!isSuccess(response.status)) {
    await discardBody(response);
    return response.status >= 500 ? TEMPLATE_UNREACHABLE : TEMPLATE_REJECTED_WITHOUT_DETAIL;
  }
  const contentLength = declaredLengthOf(response.headers.get('content-length'));
  const contentType = mediaTypeOf(response.headers.get('content-type')) ?? mediaTypeOf(mimeType);
  if ((contentLength !== null && contentLength > input.maxBytes) || response.body === null || contentType === null) {
    await discardBody(response);
    return TEMPLATE_REJECTED_WITHOUT_DETAIL;
  }
  return { ok: true, contentType, contentLength, body: cappedBody(response.body, input.maxBytes) };
}

export const whatsappGraphClientFetch = {
  fetchPhoneNumber,
  createTemplate,
  listTemplatesPage,
  deleteTemplate,
  sendMessage,
  downloadMedia,
} satisfies WhatsappGraphClient;
