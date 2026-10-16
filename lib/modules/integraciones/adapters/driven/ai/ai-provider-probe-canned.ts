import type { AiProviderProbeResult } from '../../../domain/ai-provider-failure';
import type { AiProviderProbe } from '../../../ports/ai-provider-probe';

/** Doble para el E2E: responde sin red. Una key con este prefijo hace fallar la prueba. */
export const CANNED_INVALID_KEY_PREFIX = 'E2E_INVALID';
export const CANNED_REJECTED_HTTP_STATUS = 401;
export const CANNED_ELAPSED_MS = 800;

async function probe(input: Parameters<AiProviderProbe['probe']>[0]): Promise<AiProviderProbeResult> {
  if (input.apiKey.startsWith(CANNED_INVALID_KEY_PREFIX)) {
    return {
      ok: false,
      failure: { kind: 'rejected_key', httpStatus: CANNED_REJECTED_HTTP_STATUS, model: null },
    };
  }
  return { ok: true, elapsedMs: CANNED_ELAPSED_MS };
}

export const aiProviderProbeCanned = { probe } satisfies AiProviderProbe;
