'use server';

import { identity, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  IdentityError,
  type AdministratorDetail,
  type AdministratorRow,
  type Page,
} from '@/lib/modules/identity';

import { currentPlatformActor } from './platform-session';

export type AdministratorListResult =
  | { status: 'success'; data: Page<AdministratorRow> }
  | ErrorState;

export type AdministratorDetailResult = { status: 'success'; data: AdministratorDetail } | ErrorState;

export type CreateAdministratorFormState =
  | { status: 'idle' }
  | { status: 'success'; administratorId: string; mail: 'sent' | 'failed' }
  | ErrorState;

export type AdministratorMutationFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | ErrorState;

export type ResendAdministratorLinkFormState =
  | { status: 'idle' }
  | { status: 'success'; mail: 'sent' | 'failed' }
  | ErrorState;

const toErrorState = createErrorStateTranslator(IdentityError, observabilidad.readRequestIdHeader);

// Los campos van crudos: uno ausente llega como `null` y lo rechaza el esquema del dominio. La
// empresa no se lee aqui: solo el alta la recibe.
function administratorDataFromFormData(formData: FormData): Record<string, unknown> {
  return {
    firstNames: formData.get('firstNames'),
    lastNames: formData.get('lastNames'),
    birthDate: formData.get('birthDate'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    documentTypeCode: formData.get('documentTypeCode'),
    documentNumber: formData.get('documentNumber'),
    username: formData.get('username'),
  };
}

// Sin `revalidatePath` en ninguna: la pantalla de Administradores todavia no existe.
export async function listAdministratorsAction(query: unknown): Promise<AdministratorListResult> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.listAdministrators(actor, query);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function getAdministratorAction(id: string): Promise<AdministratorDetailResult> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.getAdministrator(actor, { id });
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function createAdministratorAction(
  _prevState: CreateAdministratorFormState,
  formData: FormData,
): Promise<CreateAdministratorFormState> {
  const actor = await currentPlatformActor();

  try {
    const { administratorId, mail } = await identity.createAdministrator(actor, {
      companyId: formData.get('companyId'),
      ...administratorDataFromFormData(formData),
    });
    return { status: 'success', administratorId, mail };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function updateAdministratorAction(
  _prevState: AdministratorMutationFormState,
  formData: FormData,
): Promise<AdministratorMutationFormState> {
  const actor = await currentPlatformActor();

  try {
    await identity.updateAdministrator(actor, {
      id: formData.get('id'),
      ...administratorDataFromFormData(formData),
    });
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function deleteAdministratorAction(
  _prevState: AdministratorMutationFormState,
  formData: FormData,
): Promise<AdministratorMutationFormState> {
  const actor = await currentPlatformActor();

  try {
    await identity.deleteAdministrator(actor, { id: formData.get('id') });
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

// El destino del correo lo resuelve el repositorio: de la entrada solo se lee el identificador.
export async function resendAdministratorLinkAction(
  _prevState: ResendAdministratorLinkFormState,
  formData: FormData,
): Promise<ResendAdministratorLinkFormState> {
  const actor = await currentPlatformActor();

  try {
    const { mail } = await identity.resendAdministratorLink(actor, { id: formData.get('id') });
    return { status: 'success', mail };
  } catch (error) {
    return toErrorState(error);
  }
}
