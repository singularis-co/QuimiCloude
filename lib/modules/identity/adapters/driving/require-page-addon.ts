// Corte por añadido de una pantalla privada que no tiene permiso propio. Se llama después de
// `requirePagePermission`, con la misma lectura de sesión.
import { notFound, redirect } from 'next/navigation';

import { identity } from '@/lib/composition';
import { assertAddon, type Addon } from '@/lib/modules/identity';
import { LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

/**
 * Sin sesión redirige al login con la marca de sesión terminada; con sesión y el añadido apagado
 * responde 404, el mismo que sin permiso, para que «apagado» y «sin permiso» no se distingan.
 *
 * La pertenencia la decide `assertAddon`, no una comparación aquí: una segunda definición de «la
 * empresa tiene este añadido» podría divergir en silencio.
 */
export async function requirePageAddon(addon: Addon): Promise<void> {
  const user = await identity.getSessionUser();
  // La página y el layout se renderizan en paralelo: cualquiera de los dos puede ganar el
  // redirect, así que este también lleva la marca.
  if (user === null) redirect(LOGIN_ROUTE_SESSION_ENDED);
  assertAddon(user, addon, () => notFound());
}
