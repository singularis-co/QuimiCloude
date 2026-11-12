/**
 * El Route Handler que recibe cada trabajo de envío publicado en la cola. Sin usuario delante: la
 * única puerta es la firma del cuerpo, y se comprueba antes de interpretarlo.
 *
 * `200` le dice a la cola que no reintente; `500`, que sí.
 *
 * La configuración de segmento -`runtime` y `maxDuration`- vive en `route.ts`: Next la extrae del
 * archivo de ruta analizándolo estáticamente y no admite que se reexporte.
 */
import { integraciones } from '@/lib/composition';
import { whatsappSendJobSchema } from '@/lib/modules/integraciones';
import { forModule } from '@/lib/shared/observability/logger';

const SIGNATURE_HEADER = 'upstash-signature';

const log = forModule('integraciones');

function noBody(status: number): Response {
  return new Response(null, { status });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  const signed = await integraciones.whatsappQueueSignature.verify({ rawBody, signature });
  if (!signed) return noBody(401);

  let candidate: unknown;
  try {
    candidate = JSON.parse(rawBody);
  } catch {
    return noBody(400);
  }

  const parsed = whatsappSendJobSchema.safeParse(candidate);
  if (!parsed.success) return noBody(400);

  try {
    const result = await integraciones.processWhatsappSend(parsed.data);
    return noBody(result === 'requeue' ? 500 : 200);
  } catch {
    log.error('whatsapp_send_job_crashed', { messageId: parsed.data.messageId });
    return noBody(500);
  }
}
