/**
 * El Route Handler de la sincronización diaria de plantillas. Sin usuario delante: la única puerta
 * es el secreto del cron, y se comprueba antes de leer ninguna empresa, conexión ni plantilla.
 *
 * La configuración de segmento -`runtime` y `maxDuration`- vive en `route.ts`: Next la extrae del
 * archivo de ruta analizándolo estáticamente y no admite que se reexporte.
 */
import { integraciones } from '@/lib/composition';

const AUTHORIZATION_HEADER = 'authorization';

function noBody(status: number): Response {
  return new Response(null, { status });
}

export async function GET(request: Request): Promise<Response> {
  const verification = integraciones.verifyCronSecret(request.headers.get(AUTHORIZATION_HEADER));

  if (verification === 'misconfigured') {
    console.error('whatsapp_templates_cron_misconfigured');
    return noBody(500);
  }
  if (verification === 'unauthorized') {
    return noBody(401);
  }

  const result = await integraciones.syncAllWhatsappTemplates();

  if (result.failed.length > 0) {
    console.error('whatsapp_templates_cron_failed', {
      failedCount: result.failed.length,
      failed: result.failed,
    });
    return Response.json({ synced: result.synced, failed: result.failed.length }, { status: 500 });
  }

  return Response.json({ synced: result.synced, failed: 0 });
}
