/**
 * El Route Handler del webhook de WhatsApp: el handshake de Meta (`GET`) y la entrega de mensajes
 * y statuses (`POST`).
 *
 * Sin usuario delante: no resuelve sesion, no lee cookie y no comprueba ningun permiso. La
 * autorizacion es el verify token (`GET`) y la firma del cuerpo (`POST`), y la empresa sale de la
 * conexion de la URL, nunca de la peticion. Todo eso lo decide el caso de uso; aqui solo se lee la
 * entrada y se traduce el resultado a un codigo HTTP.
 *
 * Ningun log lleva el cuerpo, la firma, el token, un `wa_id` ni un texto. El id de la conexion
 * solo entra en un log cuando tiene forma de UUID: lo que escribe un desconocido no se registra.
 *
 * La configuracion de segmento -`runtime`- NO vive aqui sino en `route.ts`: Next la extrae del
 * archivo de ruta analizandolo estaticamente y NO admite que se reexporte.
 */
import { after } from 'next/server';
import { z } from 'zod';

import { integraciones } from '@/lib/composition';

const SIGNATURE_HEADER = 'x-hub-signature-256';
const ERROR_MESSAGE_MAX_LENGTH = 300;
const connectionIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ conexionId: string }> };

function noBody(status: number): Response {
  return new Response(null, { status });
}

function loggableConnectionId(connectionId: string): string | null {
  return connectionIdSchema.safeParse(connectionId).success ? connectionId : null;
}

function errorMessageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, ERROR_MESSAGE_MAX_LENGTH);
}

/** Corre después de mandar el 200: Meta no espera a Graph y un fallo solo deja una línea de log. */
function scheduleTemplateResync(connectionId: string): void {
  after(async () => {
    const outcome = await integraciones.resyncWhatsappTemplates(connectionId);
    if (outcome.kind === 'failed') {
      console.error('whatsapp_templates_resync_failed', {
        connectionId: loggableConnectionId(connectionId),
        code: outcome.code,
      });
    }
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { conexionId } = await context.params;
  // Solo los nombres con punto: las variantes con guion bajo quedan en `null` y se rechazan.
  const query = new URL(request.url).searchParams;

  const result = await integraciones.verifyWhatsappWebhook({
    connectionId: conexionId,
    mode: query.get('hub.mode'),
    verifyToken: query.get('hub.verify_token'),
    challenge: query.get('hub.challenge'),
  });

  if (result.kind === 'forbidden') {
    console.warn('whatsapp_webhook_verify_rejected', { reason: result.reason });
    return noBody(403);
  }

  return new Response(result.challenge, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { conexionId } = await context.params;
  // Los bytes exactos: decodificar y volver a codificar puede cambiarlos y romper la firma.
  const rawBody = new Uint8Array(await request.arrayBuffer());

  let result: Awaited<ReturnType<typeof integraciones.receiveWhatsappWebhook>>;
  try {
    result = await integraciones.receiveWhatsappWebhook({
      connectionId: conexionId,
      rawBody,
      signature: request.headers.get(SIGNATURE_HEADER),
    });
  } catch (error) {
    // Un 5xx pide a Meta que reintente: la transaccion no dejo nada a medias.
    console.error('whatsapp_webhook_store_failed', {
      connectionId: loggableConnectionId(conexionId),
      error: errorMessageOf(error),
    });
    return noBody(500);
  }

  switch (result.kind) {
    case 'ignored':
      console.warn(
        'whatsapp_webhook_ignored',
        result.reason === 'missing'
          ? { reason: result.reason }
          : { reason: result.reason, connectionId: loggableConnectionId(conexionId) },
      );
      return noBody(200);
    case 'unauthorized':
      console.warn('whatsapp_webhook_bad_signature');
      return noBody(401);
    case 'secret_unreadable':
      // 500 y no 200: los reintentos de Meta se guardan cuando el secreto vuelve a ser legible.
      console.error('whatsapp_webhook_secret_unreadable', {
        connectionId: loggableConnectionId(conexionId),
      });
      return noBody(500);
    case 'stored': {
      const { changes, messages, statuses, templates } = result.skipped;
      if (changes + messages + statuses + templates > 0) {
        // Solo numeros: quien mira el log ve que la URL o el numero de Meta no casan con la conexion.
        console.warn('whatsapp_webhook_changes_skipped', {
          connectionId: loggableConnectionId(conexionId),
          changes,
          messages,
          statuses,
          templates,
        });
      }
      if (result.followUp === 'resync_templates') scheduleTemplateResync(conexionId);
      return noBody(200);
    }
  }
}
