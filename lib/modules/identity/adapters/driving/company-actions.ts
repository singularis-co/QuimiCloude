'use server';

import { identity, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import { IdentityError, type PlatformActor } from '@/lib/modules/identity';
import { runInRequestScope } from '@/lib/shared/request-scope';

export type SetCompanyCountryFormState = { status: 'idle' } | { status: 'success' } | ErrorState;

const toErrorState = createErrorStateTranslator(IdentityError, observabilidad.readRequestIdHeader);

// Solo el usuario de la sesion, sin `getSessionContext()`: exigir empresa dejaria fuera al Maestro,
// que no tiene ninguna y es quien tiene el permiso.
async function currentPlatformActor(): Promise<PlatformActor | null> {
  const sessionUser = await runInRequestScope(() => identity.getSessionUser());
  if (sessionUser === null) return null;
  return { id: sessionUser.id, permissions: sessionUser.permissions };
}

// Sin `revalidatePath`: la pantalla que muestra el pais todavia no existe.
export async function setCompanyCountryAction(
  _prevState: SetCompanyCountryFormState,
  formData: FormData,
): Promise<SetCompanyCountryFormState> {
  const actor = await currentPlatformActor();

  try {
    // Crudos: un campo ausente llega como `null` y lo rechaza el esquema del dominio.
    await identity.setCompanyCountry(actor, {
      companyId: formData.get('companyId'),
      country: formData.get('country'),
    });
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}
