/**
 * Aterrizaje de quien ya tiene sesión: el logo y `/login` con sesión llevan aquí porque ninguno de
 * los dos conoce los permisos, y el middleware no puede consultarlos.
 *
 * La configuración de segmento vive en `route.ts`: Next no admite reexportarla.
 */
import { identity } from '@/lib/composition';
import { homeHrefFor } from '@/lib/shared/navigation/private-nav';
import { LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

export async function GET(request: Request): Promise<Response> {
  const user = await identity.getSessionUser();
  // La cookie puede seguir firmada y viva aunque la sesión ya no valga: sin la marca, el
  // middleware devolvería `/login` aquí y no terminaría nunca.
  const to = user === null ? LOGIN_ROUTE_SESSION_ENDED : homeHrefFor(user.permissions);
  return Response.redirect(new URL(to, request.url), 307);
}
