/**
 * El Route Handler del barrido de envíos de WhatsApp. Sin usuario delante: la única puerta es el
 * secreto del cron, y se comprueba antes de leer ninguna empresa ni mensaje.
 *
 * La configuración de segmento -`runtime` y `maxDuration`- vive en `route.ts`: Next la extrae del
 * archivo de ruta analizándolo estáticamente y no admite que se reexporte.
 */
import { integraciones } from '@/lib/composition';
import { forModule } from '@/lib/shared/observability/logger';

const AUTHORIZATION_HEADER = 'authorization';

const log = forModule('integraciones');

function noBody(status: number): Response {
  return new Response(null, { status });
}

export async function GET(request: Request): Promise<Response> {
  const verification = integraciones.verifyCronSecret(request.headers.get(AUTHORIZATION_HEADER));

  if (verification === 'misconfigured') {
    log.error('whatsapp_send_sweep_misconfigured');
    return noBody(500);
  }
  if (verification === 'unauthorized') {
    return noBody(401);
  }

  const { republished, failed, companiesFailed } = await integraciones.sweepWhatsappSends();
  return Response.json(
    { republished, failed, companiesFailed },
    { status: companiesFailed.length > 0 ? 500 : 200 },
  );
}
