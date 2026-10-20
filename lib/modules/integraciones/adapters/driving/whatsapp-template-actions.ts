'use server';

/**
 * Server Actions de las plantillas de WhatsApp. No deciden nada: resuelven el actor, pasan la
 * entrada tal cual y traducen el resultado o el error. Reciben argumentos planos y no `FormData`:
 * el borrador es anidado y `FormData` lo aplanaría.
 *
 * Se importa por su ruta exacta: un `'use server'` reexportado desde el barrel lo volvería
 * inimportable desde un componente de cliente.
 */

import { revalidatePath } from 'next/cache';

import { identity, integraciones, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  IntegracionesError,
  type Actor,
  type TemplateSyncSummary,
  type WhatsappTemplateList,
  type WhatsappTemplateView,
} from '@/lib/modules/integraciones';
import { runInRequestScope } from '@/lib/shared/request-scope';
import { WHATSAPP_INTEGRATION_ROUTE } from '@/lib/shared/routes';

export type WhatsappTemplateListResult = { status: 'success'; data: WhatsappTemplateList } | ErrorState;
export type WhatsappTemplateCreateResult = { status: 'success'; data: WhatsappTemplateView } | ErrorState;
export type WhatsappTemplateSyncResult = { status: 'success'; data: TemplateSyncSummary } | ErrorState;
export type WhatsappTemplateDeleteResult = { status: 'success'; data: { id: string } } | ErrorState;

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

/** Copia las dos claves: de la conexión solo sale la hora de la última sincronización. */
export async function listWhatsappTemplatesAction(input?: {
  onlyApproved?: boolean;
}): Promise<WhatsappTemplateListResult> {
  const actor = await currentActor();

  try {
    const list = await integraciones.listWhatsappTemplates(input, actor);
    return {
      status: 'success',
      data: { templates: list.templates, templatesSyncedAt: list.templatesSyncedAt },
    };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function createWhatsappTemplateAction(draft: unknown): Promise<WhatsappTemplateCreateResult> {
  const actor = await currentActor();

  try {
    const data = await integraciones.createWhatsappTemplate(draft, actor);
    refreshScreen();
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function syncWhatsappTemplatesAction(): Promise<WhatsappTemplateSyncResult> {
  const actor = await currentActor();

  try {
    const summary = await integraciones.syncWhatsappTemplates(actor);
    refreshScreen();
    return {
      status: 'success',
      data: {
        imported: summary.imported,
        updated: summary.updated,
        deleted: summary.deleted,
        skipped: summary.skipped,
        syncedAt: summary.syncedAt,
      },
    };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function deleteWhatsappTemplateAction(id: string): Promise<WhatsappTemplateDeleteResult> {
  const actor = await currentActor();

  try {
    const result = await integraciones.deleteWhatsappTemplate(id, actor);
    refreshScreen();
    return { status: 'success', data: { id: result.id } };
  } catch (error) {
    return toErrorState(error);
  }
}
