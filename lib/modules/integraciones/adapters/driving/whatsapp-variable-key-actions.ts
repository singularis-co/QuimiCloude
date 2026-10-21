'use server';

/**
 * Server Actions del diccionario de variables propias de WhatsApp. No deciden nada: resuelven el
 * actor, pasan la entrada tal cual y traducen el resultado o el error.
 *
 * Se importa por su ruta exacta: un `'use server'` reexportado desde el barrel lo volvería
 * inimportable desde un componente de cliente.
 */

import { revalidatePath } from 'next/cache';

import { identity, integraciones, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import { IntegracionesError, type Actor, type WhatsappDictionaryEntryView } from '@/lib/modules/integraciones';
import { runInRequestScope } from '@/lib/shared/request-scope';
import { WHATSAPP_INTEGRATION_ROUTE } from '@/lib/shared/routes';

export type WhatsappDictionaryListResult =
  | { status: 'success'; data: readonly WhatsappDictionaryEntryView[] }
  | ErrorState;
export type WhatsappVariableKeyResult = { status: 'success'; data: WhatsappDictionaryEntryView } | ErrorState;
export type WhatsappVariableKeyDeleteResult = { status: 'success'; data: { id: string } } | ErrorState;

const toErrorState = createErrorStateTranslator(IntegracionesError, observabilidad.readRequestIdHeader);

async function currentActor(): Promise<Actor | null> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    permissions: sessionUser.permissions,
  };
}

function refreshScreen(): void {
  revalidatePath(WHATSAPP_INTEGRATION_ROUTE);
}

/** Campo a campo: lo que el caso de uso añada a la entrada no sale sin escribirlo aquí. */
function entryOf(entry: WhatsappDictionaryEntryView): WhatsappDictionaryEntryView {
  return { id: entry.id, key: entry.key, label: entry.label, value: entry.value, usedBy: entry.usedBy };
}

export async function listWhatsappDictionaryAction(): Promise<WhatsappDictionaryListResult> {
  const actor = await currentActor();

  try {
    const entries = await integraciones.listWhatsappDictionary(actor);
    return { status: 'success', data: entries.map(entryOf) };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function createWhatsappVariableKeyAction(input: unknown): Promise<WhatsappVariableKeyResult> {
  const actor = await currentActor();

  try {
    const entry = await integraciones.createWhatsappVariableKey(input, actor);
    refreshScreen();
    return { status: 'success', data: entryOf(entry) };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function updateWhatsappVariableKeyAction(id: string, input: unknown): Promise<WhatsappVariableKeyResult> {
  const actor = await currentActor();

  try {
    const entry = await integraciones.updateWhatsappVariableKey(id, input, actor);
    refreshScreen();
    return { status: 'success', data: entryOf(entry) };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function deleteWhatsappVariableKeyAction(id: string): Promise<WhatsappVariableKeyDeleteResult> {
  const actor = await currentActor();

  try {
    const result = await integraciones.deleteWhatsappVariableKey(id, actor);
    refreshScreen();
    return { status: 'success', data: { id: result.id } };
  } catch (error) {
    return toErrorState(error);
  }
}
