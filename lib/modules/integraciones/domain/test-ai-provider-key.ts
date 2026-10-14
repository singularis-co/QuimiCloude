import { requirePermission, type Actor } from './actor';
import type { AiProviderEntry } from './ai-provider';
import { probeFailureMessage } from './ai-provider-failure';
import { aiProviderKeyInputSchema, type AiProviderKeyInput } from './ai-provider-input';
import { ValidationError } from './errors';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type { AiProviderProbe } from '../ports/ai-provider-probe';

export type TestAiProviderKeyDeps = {
  readonly catalog: AiProviderCatalog;
  readonly probe: AiProviderProbe;
};

/** Una prueba fallida es un resultado con el mensaje del proveedor, no un error del catálogo. */
export type AiProviderTestResult =
  | { readonly status: 'tested'; readonly ok: true; readonly elapsedMs: number }
  | { readonly status: 'tested'; readonly ok: false; readonly message: string };

/** Un código que el dominio conoce pero la base no trae se trata como fuera del catálogo. */
export async function parseKeyInput(
  input: unknown,
  catalog: AiProviderCatalog,
): Promise<{ readonly data: AiProviderKeyInput; readonly entry: AiProviderEntry }> {
  const parsed = aiProviderKeyInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError();
  const entry = await catalog.get(parsed.data.provider);
  if (entry === null) throw new ValidationError('proveedor fuera del catálogo');
  return { data: parsed.data, entry };
}

export async function runProbe(
  probe: AiProviderProbe,
  entry: AiProviderEntry,
  apiKey: string,
): Promise<AiProviderTestResult> {
  const result = await probe.probe({
    provider: entry.code,
    apiKey,
    models: [entry.recipeModel, entry.catalogModel],
  });
  return result.ok
    ? { status: 'tested', ok: true, elapsedMs: result.elapsedMs }
    : { status: 'tested', ok: false, message: probeFailureMessage(result.failure) };
}

export function createTestAiProviderKey(
  deps: TestAiProviderKeyDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<AiProviderTestResult> {
  return async function testAiProviderKey(input, actor) {
    requirePermission(actor);
    const { data, entry } = await parseKeyInput(input, deps.catalog);
    return runProbe(deps.probe, entry, data.apiKey);
  };
}
