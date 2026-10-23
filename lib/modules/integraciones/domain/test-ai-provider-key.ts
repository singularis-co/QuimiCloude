import { requirePermission, type Actor } from './actor';
import type { AiProviderConnectionRecord, AiProviderEntry } from './ai-provider';
import { probeFailureMessage, type AiProviderProbeResult } from './ai-provider-failure';
import { aiProviderKeyInputSchema, type AiProviderKeyInput } from './ai-provider-input';
import { ValidationError } from './errors';
import { scopeOf } from './integraciones-scope';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type { AiProviderConnectionRepository } from '../ports/ai-provider-connection-repository';
import type { AiProviderProbe } from '../ports/ai-provider-probe';

export type TestAiProviderKeyDeps = {
  readonly connections: Pick<AiProviderConnectionRepository, 'find'>;
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

/**
 * El modelo que quedará en uso al guardar: guardar con el mismo proveedor conserva la elección y
 * cambiarlo la borra.
 */
export function modelAfterSaving(
  existing: Pick<AiProviderConnectionRecord, 'provider' | 'model'> | null,
  entry: AiProviderEntry,
): string {
  return existing !== null && existing.provider === entry.code && existing.model !== null
    ? existing.model
    : entry.defaultModel;
}

export function toTestResult(result: AiProviderProbeResult): AiProviderTestResult {
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
    const existing = await deps.connections.find(scopeOf(actor));
    const result = await deps.probe.probe({
      provider: entry.code,
      apiKey: data.apiKey,
      models: [modelAfterSaving(existing, entry)],
    });
    return toTestResult(result);
  };
}
