import type { AiProviderCode } from '../domain/ai-provider';
import type { AiModelPair, AiModelPairChoice, AiModelRole } from '../domain/ai-model-pair';

/** Tabla de plataforma, sin empresa: los pares valen para todas. */
export interface AiModelPairRepository {
  list(): Promise<readonly AiModelPair[]>;
  get(provider: AiProviderCode, role: AiModelRole): Promise<AiModelPair | null>;
  /** Reemplaza el par de ese proveedor y rol (o lo crea), con su autor y la hora del guardado. */
  save(pair: AiModelPairChoice, actorId: string): Promise<AiModelPair>;
}
