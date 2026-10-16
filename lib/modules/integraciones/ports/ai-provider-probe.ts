import type { AiProviderCode } from '../domain/ai-provider';
import type { AiProviderProbeResult } from '../domain/ai-provider-failure';

/** Un fallo del proveedor o de la red es un resultado, no una excepción. */
export interface AiProviderProbe {
  probe(input: {
    readonly provider: AiProviderCode;
    readonly apiKey: string;
    readonly models: readonly string[];
  }): Promise<AiProviderProbeResult>;
}
