'use server';

/**
 * Server Actions sobre el vínculo y el bloqueo de un contacto de WhatsApp. No deciden nada:
 * resuelven el actor, pasan la entrada tal cual al caso de uso (que la valida) y traducen el error.
 *
 * Reciben un objeto y no `FormData` porque las llamarán botones del chat, no un formulario. No
 * revalidan ninguna ruta: no tienen pantalla propia, y la que llegue revalida lo suyo.
 *
 * Se importa por su ruta exacta: un `'use server'` reexportado desde el barrel lo volvería
 * inimportable desde un componente de cliente.
 */

import { identity, integraciones, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import { IntegracionesError, type Actor } from '@/lib/modules/integraciones';
import { runInRequestScope } from '@/lib/shared/request-scope';

export type WhatsappContactActionResult = { status: 'success' } | ErrorState;

const toErrorState = createErrorStateTranslator(IntegracionesError, observabilidad.readRequestIdHeader);

/** Lleva los añadidos de la empresa: sin `integraciones` activo, el caso de uso rechaza. */
async function currentActor(): Promise<Actor | null> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    permissions: sessionUser.permissions,
    addons: sessionUser.addons,
  };
}

async function run(operation: (actor: Actor | null) => Promise<void>): Promise<WhatsappContactActionResult> {
  const actor = await currentActor();

  try {
    await operation(actor);
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function linkWhatsappContactAction(input: {
  contactId: string;
  customerId: string;
}): Promise<WhatsappContactActionResult> {
  return run((actor) => integraciones.linkWhatsappContact(input, actor));
}

export async function unlinkWhatsappContactAction(input: {
  contactId: string;
}): Promise<WhatsappContactActionResult> {
  return run((actor) => integraciones.unlinkWhatsappContact(input, actor));
}

export async function blockWhatsappContactAction(input: {
  contactId: string;
}): Promise<WhatsappContactActionResult> {
  return run((actor) => integraciones.setWhatsappContactBlocked({ ...input, blocked: true }, actor));
}

export async function unblockWhatsappContactAction(input: {
  contactId: string;
}): Promise<WhatsappContactActionResult> {
  return run((actor) => integraciones.setWhatsappContactBlocked({ ...input, blocked: false }, actor));
}
