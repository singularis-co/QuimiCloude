import {
  WhatsappMetaRejectedError,
  WhatsappMetaUnreachableError,
  WhatsappTemplateNameTakenError,
  WhatsappTemplateRateLimitedError,
  WhatsappTemplateRejectedError,
  type IntegracionesError,
} from './errors';
import { metaMessageOf, type GraphFailure } from './graph-failure';

export const TEMPLATE_NAME_TAKEN_SUBCODE = 2388024;
export const META_RATE_LIMITED_CODE = 80008;

export type TemplateGraphOperation = 'create' | 'sync' | 'delete';

const OPERATION_LABEL: Record<TemplateGraphOperation, string> = {
  create: 'crear plantilla',
  sync: 'listar plantillas',
  delete: 'eliminar plantilla',
};

/** Para el log del servidor: el texto de Meta va con el Access Token y el App Secret tachados. */
export function templateFailureDiagnostic(
  operation: TemplateGraphOperation,
  failure: GraphFailure,
  secrets: readonly string[],
): string {
  const code = failure.code ?? null;
  const subcode = failure.subcode ?? null;
  return `Graph ${OPERATION_LABEL[operation]}: ${failure.kind}; code=${code ?? '-'}; subcode=${subcode ?? '-'}; ${metaMessageOf(failure, secrets)}`;
}

export function templateGraphErrorOf(
  operation: TemplateGraphOperation,
  failure: GraphFailure,
  secrets: readonly string[],
): IntegracionesError {
  const diagnostic = templateFailureDiagnostic(operation, failure, secrets);
  if (failure.kind === 'unreachable') return new WhatsappMetaUnreachableError(diagnostic);
  if (operation !== 'create') return new WhatsappMetaRejectedError(diagnostic);
  if (failure.subcode === TEMPLATE_NAME_TAKEN_SUBCODE) return new WhatsappTemplateNameTakenError(diagnostic);
  if (failure.code === META_RATE_LIMITED_CODE) return new WhatsappTemplateRateLimitedError(diagnostic);
  return new WhatsappTemplateRejectedError(diagnostic);
}
