'use server';

import { identity, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  IdentityError,
  type CompanyAddonsView,
  type CompanyDeletionImpact,
  type CompanyDetail,
  type CompanyEventView,
  type CompanyRow,
  type CreateCompanyResult,
  type Page,
} from '@/lib/modules/identity';

import { currentPlatformActor } from './platform-session';

export type SetCompanyCountryFormState = { status: 'idle' } | { status: 'success' } | ErrorState;

export type CreateCompanyFormState =
  | { status: 'idle' }
  | {
      status: 'success';
      companyId: string;
      administratorId: string;
      mail: CreateCompanyResult['mail'];
    }
  | ErrorState;

export type CompanyMutationFormState = { status: 'idle' } | { status: 'success' } | ErrorState;

export type CompanyListResult = { status: 'success'; data: Page<CompanyRow> } | ErrorState;

export type CompanyDetailResult = { status: 'success'; data: CompanyDetail } | ErrorState;

export type CompanyDeletionImpactResult =
  | { status: 'success'; data: CompanyDeletionImpact }
  | ErrorState;

export type CompanyEventListResult =
  | { status: 'success'; data: Page<CompanyEventView> }
  | ErrorState;

export type CompanyAddonsResult = { status: 'success'; data: CompanyAddonsView } | ErrorState;

export type CompanyAddonsFormState =
  | { status: 'idle' }
  | { status: 'success'; data: CompanyAddonsView }
  | ErrorState;

const toErrorState = createErrorStateTranslator(IdentityError, observabilidad.readRequestIdHeader);

// Los campos van crudos: uno ausente llega como `null` y lo rechaza el esquema del dominio.
function companyDataFromFormData(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get('name'),
    taxId: formData.get('taxId'),
    contactEmail: formData.get('contactEmail'),
    contactPhone: formData.get('contactPhone'),
  };
}

function administratorFromFormData(formData: FormData): Record<string, unknown> {
  return {
    firstNames: formData.get('adminFirstNames'),
    lastNames: formData.get('adminLastNames'),
    birthDate: formData.get('adminBirthDate'),
    email: formData.get('adminEmail'),
    phone: formData.get('adminPhone'),
    documentTypeCode: formData.get('adminDocumentTypeCode'),
    documentNumber: formData.get('adminDocumentNumber'),
    username: formData.get('adminUsername'),
  };
}

// Sin `revalidatePath` en ninguna: la pantalla de empresas todavia no existe.
export async function setCompanyCountryAction(
  _prevState: SetCompanyCountryFormState,
  formData: FormData,
): Promise<SetCompanyCountryFormState> {
  const actor = await currentPlatformActor();

  try {
    await identity.setCompanyCountry(actor, {
      companyId: formData.get('companyId'),
      country: formData.get('country'),
    });
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function createCompanyAction(
  _prevState: CreateCompanyFormState,
  formData: FormData,
): Promise<CreateCompanyFormState> {
  const actor = await currentPlatformActor();

  try {
    const { companyId, administratorId, mail } = await identity.createCompany(actor, {
      company: companyDataFromFormData(formData),
      administrator: administratorFromFormData(formData),
    });
    return { status: 'success', companyId, administratorId, mail };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function updateCompanyAction(
  _prevState: CompanyMutationFormState,
  formData: FormData,
): Promise<CompanyMutationFormState> {
  const actor = await currentPlatformActor();

  try {
    await identity.updateCompany(actor, {
      companyId: formData.get('companyId'),
      ...companyDataFromFormData(formData),
    });
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function deleteCompanyAction(
  _prevState: CompanyMutationFormState,
  formData: FormData,
): Promise<CompanyMutationFormState> {
  const actor = await currentPlatformActor();

  try {
    await identity.deleteCompany(actor, {
      companyId: formData.get('companyId'),
      confirmationName: formData.get('confirmationName'),
    });
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function reactivateCompanyAction(
  _prevState: CompanyMutationFormState,
  formData: FormData,
): Promise<CompanyMutationFormState> {
  const actor = await currentPlatformActor();

  try {
    await identity.reactivateCompany(actor, { companyId: formData.get('companyId') });
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function listCompaniesAction(query: unknown): Promise<CompanyListResult> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.listCompanies(actor, query);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function getCompanyAction(companyId: string): Promise<CompanyDetailResult> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.getCompany(actor, { companyId });
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function getCompanyDeletionImpactAction(
  companyId: string,
): Promise<CompanyDeletionImpactResult> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.getCompanyDeletionImpact(actor, { companyId });
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function listCompanyEventsAction(input: unknown): Promise<CompanyEventListResult> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.listCompanyEvents(actor, input);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

// Del formulario llega texto: solo «true» y «false» se traducen; cualquier otro valor sigue crudo
// y lo rechaza el esquema del dominio.
function enabledFromFormData(formData: FormData): unknown {
  const raw = formData.get('enabled');
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

export async function getCompanyAddonsAction(companyId: string): Promise<CompanyAddonsResult> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.getCompanyAddons(actor, { companyId });
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function setCompanyAddonAction(
  _prevState: CompanyAddonsFormState,
  formData: FormData,
): Promise<CompanyAddonsFormState> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.setCompanyAddon(actor, {
      companyId: formData.get('companyId'),
      addon: formData.get('addon'),
      enabled: enabledFromFormData(formData),
    });
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function setAllCompanyAddonsAction(
  _prevState: CompanyAddonsFormState,
  formData: FormData,
): Promise<CompanyAddonsFormState> {
  const actor = await currentPlatformActor();

  try {
    const data = await identity.setAllCompanyAddons(actor, {
      companyId: formData.get('companyId'),
      enabled: enabledFromFormData(formData),
    });
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}
