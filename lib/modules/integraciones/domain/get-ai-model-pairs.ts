import { requirePlatformPermission, type PlatformActor } from '@/lib/modules/identity';

import type { AiModelPair } from './ai-model-pair';
import type { AiCatalogModel, AiProviderCode } from './ai-provider';

import type { AiModelPairRepository } from '../ports/ai-model-pair-repository';
import type { AiProviderCatalog } from '../ports/ai-provider-catalog';

export type GetAiModelPairsDeps = {
  readonly catalog: AiProviderCatalog;
  readonly pairs: AiModelPairRepository;
};

/** Un proveedor del catálogo con sus modelos (y sus marcas) y sus dos pares; `null` es «sin par». */
export type AiModelPairsProvider = {
  readonly code: AiProviderCode;
  readonly name: string;
  readonly models: readonly AiCatalogModel[];
  readonly agent: AiModelPair | null;
  readonly router: AiModelPair | null;
};

export type AiModelPairsOverview = { readonly providers: readonly AiModelPairsProvider[] };

/** Sin probe ni cipher: el Maestro no tiene key y leer los pares no consulta a ningún proveedor. */
export function createGetAiModelPairs(
  deps: GetAiModelPairsDeps,
): (actor: PlatformActor | null | undefined) => Promise<AiModelPairsOverview> {
  return async function getAiModelPairs(actor) {
    requirePlatformPermission(actor, 'modelos_ia.consultar');
    const [entries, pairs] = await Promise.all([deps.catalog.list(), deps.pairs.list()]);
    const pairOf = (code: AiProviderCode, role: AiModelPair['role']) =>
      pairs.find((pair) => pair.provider === code && pair.role === role) ?? null;
    return {
      providers: entries.map((entry) => ({
        code: entry.code,
        name: entry.name,
        models: entry.models,
        agent: pairOf(entry.code, 'AGENT'),
        router: pairOf(entry.code, 'ROUTER'),
      })),
    };
  };
}
