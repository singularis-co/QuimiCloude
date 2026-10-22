import type {
  GraphProbeResult,
  GraphTemplateCreated,
  GraphTemplateDeleted,
  GraphTemplatePage,
  WhatsappGraphClient,
} from '../../../ports/whatsapp-graph-client';

/** Doble para el E2E: responde sin red. Un Access Token con este prefijo hace fallar la prueba. */
export const CANNED_INVALID_TOKEN_PREFIX = 'E2E_INVALID';
export const CANNED_GRAPH_ERROR_MESSAGE = 'Invalid OAuth access token - Cannot parse access token';
export const CANNED_DISPLAY_PHONE_NUMBER = '+57 300 0000000';
export const CANNED_VERIFIED_NAME = 'Empresa de prueba E2E';

/** Un nombre con este prefijo hace que Meta conteste «ya existe en ese idioma». */
export const CANNED_TAKEN_NAME_PREFIX = 'e2e_repetida';
export const CANNED_TAKEN_NAME_MESSAGE = 'Content in This Language Already Exists';
export const CANNED_TAKEN_NAME_CODE = 100;
export const CANNED_TAKEN_NAME_SUBCODE = 2388024;
const CANNED_TEMPLATE_ID_BASE = 1000;

type CannedTemplate = {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly status: string;
  readonly category: string;
  readonly components: readonly unknown[];
};

/**
 * En memoria del proceso: sin esto, una sincronización en el E2E borraría lo que se acaba de
 * crear, porque Meta no lo listaría.
 */
const templatesByWaba = new Map<string, CannedTemplate[]>();
let lastTemplateId = CANNED_TEMPLATE_ID_BASE;

export function resetCannedTemplates(): void {
  templatesByWaba.clear();
  lastTemplateId = CANNED_TEMPLATE_ID_BASE;
}

async function fetchPhoneNumber(input: {
  readonly phoneNumberId: string;
  readonly accessToken: string;
}): Promise<GraphProbeResult> {
  if (input.accessToken.startsWith(CANNED_INVALID_TOKEN_PREFIX)) {
    return { ok: false, kind: 'rejected', message: CANNED_GRAPH_ERROR_MESSAGE };
  }
  return {
    ok: true,
    phone: { displayPhoneNumber: CANNED_DISPLAY_PHONE_NUMBER, verifiedName: CANNED_VERIFIED_NAME },
  };
}

async function createTemplate(input: {
  readonly wabaId: string;
  readonly accessToken: string;
  readonly name: string;
  readonly language: string;
  readonly category: string;
  readonly components: readonly unknown[];
}): Promise<GraphTemplateCreated> {
  if (input.name.startsWith(CANNED_TAKEN_NAME_PREFIX)) {
    return {
      ok: false,
      kind: 'rejected',
      message: CANNED_TAKEN_NAME_MESSAGE,
      code: CANNED_TAKEN_NAME_CODE,
      subcode: CANNED_TAKEN_NAME_SUBCODE,
    };
  }
  lastTemplateId += 1;
  const template: CannedTemplate = {
    id: String(lastTemplateId),
    name: input.name,
    language: input.language,
    status: 'PENDING',
    category: input.category,
    components: input.components,
  };
  templatesByWaba.set(input.wabaId, [...(templatesByWaba.get(input.wabaId) ?? []), template]);
  return { ok: true, id: template.id, status: template.status, category: template.category };
}

async function listTemplatesPage(input: {
  readonly wabaId: string;
  readonly accessToken: string;
  readonly after: string | null;
}): Promise<GraphTemplatePage> {
  const items = (templatesByWaba.get(input.wabaId) ?? []).map((template) => ({ ...template }));
  return { ok: true, items, next: null };
}

async function deleteTemplate(input: {
  readonly wabaId: string;
  readonly accessToken: string;
  readonly hsmId: string;
  readonly name: string;
}): Promise<GraphTemplateDeleted> {
  const remaining = (templatesByWaba.get(input.wabaId) ?? []).filter(
    (template) => !(template.id === input.hsmId && template.name === input.name),
  );
  templatesByWaba.set(input.wabaId, remaining);
  return { ok: true };
}

export const whatsappGraphClientCanned = {
  fetchPhoneNumber,
  createTemplate,
  listTemplatesPage,
  deleteTemplate,
} satisfies WhatsappGraphClient;
