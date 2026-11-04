import { requirePlatformPermission, type PlatformActor } from '@/lib/modules/identity';

import { aiModelPairProblems, type AiModelPair } from './ai-model-pair';
import { aiModelPairInputSchema } from './ai-model-pair-input';
import { ValidationError } from './errors';

import type { AiModelPairRepository } from '../ports/ai-model-pair-repository';
import type { AiProviderCatalog } from '../ports/ai-provider-catalog';

export type SaveAiModelPairDeps = {
  readonly catalog: AiProviderCatalog;
  readonly pairs: AiModelPairRepository;
};

export type SaveAiModelPairResult = { readonly status: 'saved'; readonly pair: AiModelPair };

/**
 * Sin consulta al proveedor: el Maestro no tiene key y el par vale para todas las empresas. Que
 * cada modelo siga admitiendo herramientas se vuelve a mirar en cada uso.
 */
export function createSaveAiModelPair(
  deps: SaveAiModelPairDeps,
): (input: unknown, actor: PlatformActor | null | undefined) => Promise<SaveAiModelPairResult> {
  return async function saveAiModelPair(input, actor) {
    requirePlatformPermission(actor, 'modelos_ia.modificar');
    const parsed = aiModelPairInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const choice = parsed.data;

    const entry = await deps.catalog.get(choice.provider);
    if (entry === null) throw new ValidationError(`el catálogo no trae el proveedor ${choice.provider}`);

    const problems = aiModelPairProblems(entry, choice.role, choice.primaryModelId, choice.fallbackModelId);
    if (problems.length > 0) throw new ValidationError(problems.join('; '));

    const pair = await deps.pairs.save(choice, actor.id);
    return { status: 'saved', pair };
  };
}
