import { z } from 'zod';

import { readGraphApiVersion } from '../config/whatsapp-config-env';

import type { GraphFailure } from '../../../domain/graph-failure';
import type {
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

export const whatsappGraphClientFetch = {
  fetchPhoneNumber,
  createTemplate,
  listTemplatesPage,
  deleteTemplate,
} satisfies WhatsappGraphClient;
