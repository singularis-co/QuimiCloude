import { identity } from '@/lib/composition';
import type { PlatformActor } from '@/lib/modules/identity';
import { runInRequestScope } from '@/lib/shared/request-scope';

// Solo el usuario de la sesion, sin `getSessionContext()`: exigir empresa dejaria fuera al Maestro,
// que no tiene ninguna y es quien tiene el permiso.
export async function currentPlatformActor(): Promise<PlatformActor | null> {
  const sessionUser = await runInRequestScope(() => identity.getSessionUser());
  if (sessionUser === null) return null;
  return { id: sessionUser.id, permissions: sessionUser.permissions };
}
