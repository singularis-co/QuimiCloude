// Dobles compartidos por los tests de `runDocumentJob` que no miran al proveedor IA: una empresa
// con conexion `ACTIVE` y la cadena de lectura ya construida que el test quiere observar.

import { vi } from 'vitest';

import { createRunDocumentJob } from '@/lib/modules/documentos/domain/run-document-job';

import type {
  AiProviderGateway,
  AiReaderLookup,
  DocumentPipeline,
  RunDocumentJobDeps,
} from '@/lib/modules/documentos/domain/run-document-job';
import type { AiReader } from '@/lib/modules/documentos/ports/ai-reader';

/** Un lector que no deberia llamarse nunca: en estos tests la cadena es un doble entero. */
export const LECTOR_INERTE: AiReader = {
  read: async () => {
    throw new Error('la cadena simulada no lee con el lector');
  },
};

export function dobleDeProveedor(
  lookup: AiReaderLookup = { status: 'ready', reader: LECTOR_INERTE, connectionStatus: 'ACTIVE' },
) {
  const isConfigured = vi.fn<AiProviderGateway['isConfigured']>(async () => lookup.status !== 'missing');
  const readerFor = vi.fn<AiProviderGateway['readerFor']>(async () => lookup);
  const reportAccountFailure = vi.fn<AiProviderGateway['reportAccountFailure']>(async () => {});
  const reportRecovered = vi.fn<AiProviderGateway['reportRecovered']>(async () => {});
  const aiProvider: AiProviderGateway = { isConfigured, readerFor, reportAccountFailure, reportRecovered };
  return { aiProvider, isConfigured, readerFor, reportAccountFailure, reportRecovered };
}

/**
 * `createRunDocumentJob` con una empresa conectada y la cadena dada. Afirma, ademas, que la
 * cadena se construye sobre el lector que entrego el proveedor y no sobre otro.
 */
export function trabajoConProveedor(
  deps: Omit<RunDocumentJobDeps, 'aiProvider' | 'pipelineFor'> & DocumentPipeline,
) {
  const { processPdfByStrategy, cropCatalogImages, ...resto } = deps;
  const proveedor = dobleDeProveedor();
  const pipelineFor = vi.fn((reader: AiReader): DocumentPipeline => {
    if (reader === LECTOR_INERTE) throw new Error('la cadena debe recibir el lector observado');
    return { processPdfByStrategy, cropCatalogImages };
  });
  return createRunDocumentJob({ ...resto, aiProvider: proveedor.aiProvider, pipelineFor });
}
