/**
 * El Route Handler del archivo de una imagen o un sticker de WhatsApp. Lo consume un `<img src>`, por
 * eso es una ruta y no una Server Action. `/api/**` no pasa por el middleware: la sesión se lee aquí.
 *
 * «No existe» y «no puedes» dan el mismo 404 sin cuerpo. Ningún log lleva el id del mensaje, el
 * del archivo en Meta, el cuerpo, el número ni el nombre del cliente.
 *
 * `runtime` vive en `route.ts`: Next lo extrae del archivo de ruta y no admite reexportarlo.
 */
import { identity, integraciones } from '@/lib/composition';
import { IntegracionesError, type Actor, type WhatsappMediaResult } from '@/lib/modules/integraciones';
import { runInRequestScope } from '@/lib/shared/request-scope';

type RouteContext = { params: Promise<{ mensajeId: string }> };

const NOT_FOUND_CODES: ReadonlySet<string> = new Set(['unauthorized', 'invalid_input', 'whatsapp_message_not_found']);
const ERROR_MESSAGE_MAX_LENGTH = 300;

function noBody(status: number): Response {
  return new Response(null, { status });
}

async function currentActor(): Promise<Actor | null> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    permissions: sessionUser.permissions,
  };
}

function fileResponse(result: Extract<WhatsappMediaResult, { kind: 'file' }>): Response {
  const headers = new Headers({
    'content-type': result.contentType,
    'cache-control': 'private, max-age=3600',
    'x-content-type-options': 'nosniff',
    'content-disposition': 'inline',
  });
  if (result.contentLength !== null) headers.set('content-length', String(result.contentLength));
  return new Response(result.body, { status: 200, headers });
}

function logFailure(error: unknown): void {
  if (error instanceof IntegracionesError) {
    console.error('whatsapp_media_failed', { code: error.code });
    return;
  }
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  console.error('whatsapp_media_failed', { error: `${name}: ${message.slice(0, ERROR_MESSAGE_MAX_LENGTH)}` });
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { mensajeId } = await context.params;
  try {
    const actor = await currentActor();
    const result = await integraciones.getWhatsappMedia({ messageId: mensajeId }, actor);
    return result.kind === 'file' ? fileResponse(result) : noBody(502);
  } catch (error) {
    if (error instanceof IntegracionesError && NOT_FOUND_CODES.has(error.code)) return noBody(404);
    logFailure(error);
    return noBody(500);
  }
}
