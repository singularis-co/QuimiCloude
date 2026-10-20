import type { AiProviderCode, AiProviderEntry } from '../domain/ai-provider';

/** Tabla global, sin empresa. Las filas cuyo código no conoce el dominio no salen. */
export interface AiProviderCatalog {
  /** Por `sort_order`. */
  list(): Promise<readonly AiProviderEntry[]>;
  get(code: AiProviderCode): Promise<AiProviderEntry | null>;
}
