'use server';

/**
 * Server Actions del envío de WhatsApp. No deciden nada: resuelven el actor, pasan la entrada tal
 * cual al caso de uso (que la valida) y traducen el resultado o el error. No revalidan ninguna
 * ruta: no tienen pantalla propia, y la que llegue revalida lo suyo.
 *
 * Se importa por su ruta exacta: un `'use server'` reexportado desde el barrel lo volvería
 * inimportable desde un componente de cliente.
 */

import { identity, integraciones, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  IntegracionesError,
  WhatsappTemplateValuesMissingError,
  type Actor,
  type WhatsappOutboundMessageView,
} from '@/lib/modules/integraciones';
import { runInRequestScope } from '@/lib/shared/request-scope';

type MissingValue = { readonly key: string; readonly label: string };

export type WhatsappSendResult =
  | { status: 'success'; data: WhatsappOutboundMessageView }
  | { status: 'missing_values'; message: string; missing: readonly MissingValue[] }
  | ErrorState;

type SendOutcome = { readonly message: WhatsappOutboundMessageView };

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

/** «Falta el valor de A» / «Falta el valor de A, B y C». */
function missingValuesMessage(missing: readonly MissingValue[]): string {
  const labels = missing.map((entry) => entry.label);
  const last = labels.pop();
  return labels.length === 0 ? `Falta el valor de ${last ?? ''}` : `Falta el valor de ${labels.join(', ')} y ${last}`;
}

/** El aviso de un fallo de Meta lo escribe el caso de uso por su puerto de log, no esta acción. */
async function run(operation: (actor: Actor | null) => Promise<SendOutcome>): Promise<WhatsappSendResult> {
  const actor = await currentActor();

  try {
    const { message } = await operation(actor);
    return {
      status: 'success',
      data: {
        id: message.id,
        type: message.type,
        status: message.status,
        body: message.body,
        templateName: message.templateName,
        templateLanguage: message.templateLanguage,
        errorCode: message.errorCode,
        errorReason: message.errorReason,
        createdAt: message.createdAt,
      },
    };
  } catch (error) {
    if (error instanceof WhatsappTemplateValuesMissingError) {
      const missing = error.missing.map((entry) => ({ key: entry.key, label: entry.label }));
      return { status: 'missing_values', message: missingValuesMessage(missing), missing };
    }
    return toErrorState(error);
  }
}

/** `input`: `{ kind: 'text', recipient, text }` o `{ kind: 'template', recipient, templateId, constants, constantLabels }`. */
export async function sendWhatsappMessageAction(input: unknown): Promise<WhatsappSendResult> {
  return run((actor) => integraciones.sendWhatsappMessage(input, actor));
}

/** `input`: `{ messageId, constants, constantLabels }`. */
export async function retryWhatsappMessageAction(input: unknown): Promise<WhatsappSendResult> {
  return run((actor) => integraciones.retryWhatsappMessage(input, actor));
}
