import type { AiCatalogEntry, AiProviderCode } from './ai-provider';

export const AI_MODEL_ROLES = ['AGENT', 'ROUTER'] as const;
export type AiModelRole = (typeof AI_MODEL_ROLES)[number];

/** Lo que el Maestro elige para un proveedor y un rol: un principal y su respaldo. */
export type AiModelPairChoice = {
  readonly provider: AiProviderCode;
  readonly role: AiModelRole;
  readonly primaryModelId: string;
  readonly fallbackModelId: string;
};

/** `updatedBy` nulo: el par lo sembró la migración y nadie lo ha cambiado. */
export type AiModelPair = AiModelPairChoice & {
  readonly updatedBy: string | null;
  readonly updatedAt: Date;
};

/**
 * Pura: los problemas de un par contra el catálogo de su proveedor, vacío si vale. Los dos modelos
 * tienen que admitir herramientas; solo el principal del enrutador tiene que ser económico, porque
 * el respaldo entra cuando el principal falla y puede ser uno más capaz.
 */
export function aiModelPairProblems(
  entry: AiCatalogEntry,
  role: AiModelRole,
  primaryModelId: string,
  fallbackModelId: string,
): readonly string[] {
  const problems: string[] = [];
  const primary = entry.models.find((model) => model.modelId === primaryModelId);
  const fallback = entry.models.find((model) => model.modelId === fallbackModelId);

  if (primary === undefined) problems.push(`el principal ${primaryModelId} no está en el catálogo de ${entry.code}`);
  if (fallback === undefined) problems.push(`el respaldo ${fallbackModelId} no está en el catálogo de ${entry.code}`);
  if (primaryModelId === fallbackModelId) problems.push('el principal y el respaldo son el mismo modelo');
  if (primary !== undefined && !primary.supportsTools) problems.push(`el principal ${primaryModelId} no admite herramientas`);
  if (fallback !== undefined && !fallback.supportsTools) problems.push(`el respaldo ${fallbackModelId} no admite herramientas`);
  if (role === 'ROUTER' && primary !== undefined && !primary.isEconomic) {
    problems.push(`el principal del enrutador ${primaryModelId} no es económico`);
  }
  return problems;
}
