/**
 * La tarea diaria que borra los avisos vencidos. Sin usuario delante: la única puerta es el
 * secreto del cron, y se comprueba antes de leer nada. Recorre también las empresas dadas de baja.
 */
import { notificaciones } from '@/lib/composition';

const AUTHORIZATION_HEADER = 'authorization';

function noBody(status: number): Response {
  return new Response(null, { status });
}

export async function GET(request: Request): Promise<Response> {
  const verification = notificaciones.verifyCronSecret(request.headers.get(AUTHORIZATION_HEADER));
  if (verification === 'misconfigured') {
    console.error('notification_purge_misconfigured');
    return noBody(500);
  }
  if (verification === 'unauthorized') return noBody(401);

  const companyIds = await notificaciones.listCompanyIds();
  let deleted = 0;
  const failed: string[] = [];
  // Una empresa cada vez, y el fallo de una no corta a las demás.
  for (const companyId of companyIds) {
    try {
      deleted += (await notificaciones.purgeExpiredNotifications(companyId)).deleted;
    } catch (error) {
      failed.push(companyId);
      console.error('notification_purge_failed', {
        companyId,
        error: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  if (failed.length > 0) {
    return Response.json({ deleted, failedCount: failed.length }, { status: 500 });
  }
  return Response.json({ deleted });
}
