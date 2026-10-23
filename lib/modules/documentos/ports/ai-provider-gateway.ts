/**
 * El puerto por el que `documentos` pide el lector de la empresa y le cuenta a la conexión cómo
 * fue la lectura. La key no cruza este puerto: llega ya dentro del `AiReader`.
 */
import type { AiReader } from './ai-reader';
import type { AiProviderFailure } from '@/lib/modules/integraciones';

export type AiReaderLookup =
  | { readonly status: 'missing' }
  | { readonly status: 'unreadable' }
  | {
      readonly status: 'ready';
      readonly reader: AiReader;
      readonly connectionStatus: 'ACTIVE' | 'ERROR';
    };

export interface AiProviderGateway {
  isConfigured(companyId: string): Promise<boolean>;
  readerFor(companyId: string): Promise<AiReaderLookup>;
  reportConnectionFailure(companyId: string, failure: AiProviderFailure): Promise<void>;
  reportRecovered(companyId: string): Promise<void>;
}
