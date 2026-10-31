'use server';

/**
 * Server Actions del agente de IA de WhatsApp: su configuración y el modo de cada conversación. No deciden nada: resuelven el actor, pasan la
 * entrada tal cual al caso de uso (que la valida) y traducen el error.
 *
 * Reciben un objeto y no `FormData`. No revalidan ninguna ruta: aún no hay pantalla que las use.
 *
 * Se importa por su ruta exacta: un `'use server'` reexportado desde el barrel lo volvería
 * inimportable desde un componente de cliente.
 */

import { identity, integraciones, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  IntegracionesError,
  type Actor,
  type ConversationModeInput,
  type ConversationModeView,
  type SaveWhatsappAgentSettingsInput,
  type WhatsappAgentSettings,
} from '@/lib/modules/integraciones';
import { runInRequestScope } from '@/lib/shared/request-scope';

export type GetWhatsappAgentSettingsActionResult =
  | { status: 'success'; settings: WhatsappAgentSettings }
  | ErrorState;

export type SaveWhatsappAgentSettingsActionResult = { status: 'success' } | ErrorState;

export type ChangeWhatsappConversationModeActionResult = { status: 'success' } | ErrorState;

export type GetWhatsappConversationModeActionResult = ({ status: 'success' } & ConversationModeView) | ErrorState;

const toErrorState = createErrorStateTranslator(IntegracionesError, observabilidad.readRequestIdHeader);

/** Lleva los añadidos de la empresa: los casos de uso del modo de la conversación los miran. */
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

export async function getWhatsappAgentSettingsAction(): Promise<GetWhatsappAgentSettingsActionResult> {
  const actor = await currentActor();

  try {
    const settings = await integraciones.getWhatsappAgentSettings(actor);
    return { status: 'success', settings };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function saveWhatsappAgentSettingsAction(
  input: SaveWhatsappAgentSettingsInput,
): Promise<SaveWhatsappAgentSettingsActionResult> {
  const actor = await currentActor();

  try {
    await integraciones.saveWhatsappAgentSettings(input, actor);
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function handOffWhatsappConversationAction(
  input: ConversationModeInput,
): Promise<ChangeWhatsappConversationModeActionResult> {
  const actor = await currentActor();

  try {
    await integraciones.handOffWhatsappConversation(input, actor);
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function returnWhatsappConversationToAgentAction(
  input: ConversationModeInput,
): Promise<ChangeWhatsappConversationModeActionResult> {
  const actor = await currentActor();

  try {
    await integraciones.returnWhatsappConversationToAgent(input, actor);
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function getWhatsappConversationModeAction(
  input: ConversationModeInput,
): Promise<GetWhatsappConversationModeActionResult> {
  const actor = await currentActor();

  try {
    const view = await integraciones.getWhatsappConversationMode(input, actor);
    return { status: 'success', mode: view.mode, reason: view.reason, changedAt: view.changedAt };
  } catch (error) {
    return toErrorState(error);
  }
}
