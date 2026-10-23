// El trabajo de la cola con la lectura de PDF apagada en la empresa del archivo: se descarta como
// fallo definitivo justo despues de reclamar la fila, sin tanda, sin lector, sin descarga y sin
// cadena de lectura. Los dobles de todo lo que no debe correr fallan si alguien los llama.

import { describe, expect, it, vi } from 'vitest';

import { failureKind } from '@/lib/modules/documentos/domain/failure-kind';
import { createRunDocumentJob } from '@/lib/modules/documentos/domain/run-document-job';
import { createIsCompanyAddonActive, type Addon } from '@/lib/modules/identity';

import type { ReadBatch } from '@/lib/modules/documentos/domain/batch-status';
import type { AiProviderGateway } from '@/lib/modules/documentos/domain/run-document-job';
import type {
  ClaimedFile,
  DocumentBatchRepository,
  JobOutcome,
} from '@/lib/modules/documentos/ports/document-batch-repository';
import type { DocumentStorage } from '@/lib/modules/documentos/ports/document-storage';
import type { PdfReadingSwitch } from '@/lib/modules/documentos/ports/pdf-reading-switch';

const EMPRESA = '44444444-4444-4444-8444-444444444444';
const MENSAJE = { documentFileId: 'archivo-1', messageId: 'mensaje-1' };
const FILA: ClaimedFile = {
  id: 'archivo-1',
  companyId: EMPRESA,
  batchId: 'tanda-1',
  path: `${EMPRESA}/documento.pdf`,
};

function prohibido(que: string) {
  return vi.fn(async (): Promise<never> => {
    throw new Error(`con la lectura de PDF apagada no se llama a ${que}`);
  });
}

function montar(pdfReading: PdfReadingSwitch) {
  const claim = vi.fn(async (): Promise<ClaimedFile | null> => FILA);
  const finish = vi.fn<DocumentBatchRepository['finish']>(async () => {});
  const batch: ReadBatch = { id: 'tanda-1', companyId: EMPRESA, strategy: 'formula', files: [] };
  const readBatch = vi.fn(async (): Promise<ReadBatch | null> => batch);
  const repository: DocumentBatchRepository = {
    createBatch: prohibido('createBatch'),
    attachMessageId: prohibido('attachMessageId'),
    claim,
    finish,
    expireStale: prohibido('expireStale'),
    readBatch,
    readFileForReview: prohibido('readFileForReview'),
  };
  const download = prohibido('download');
  const remove = prohibido('remove');
  const storage: DocumentStorage = {
    createSignedUpload: prohibido('createSignedUpload'),
    createSignedReadUrl: prohibido('createSignedReadUrl'),
    download,
    remove,
  };
  const readerFor = vi.fn<AiProviderGateway['readerFor']>(async () => ({ status: 'missing' }));
  const aiProvider: AiProviderGateway = {
    isConfigured: prohibido('isConfigured'),
    readerFor,
    reportConnectionFailure: prohibido('reportConnectionFailure'),
    reportRecovered: prohibido('reportRecovered'),
  };
  const pipelineFor = vi.fn(() => {
    throw new Error('con la lectura de PDF apagada no se construye la cadena de lectura');
  });
  const runDocumentJob = createRunDocumentJob({ repository, storage, aiProvider, pdfReading, pipelineFor });
  return { runDocumentJob, claim, finish, readBatch, readerFor, download, remove, pipelineFor };
}

/** El interruptor tal como lo ata la composicion, sobre los interruptores guardados que se le den. */
function interruptorDeComposicion(stored: readonly string[], alive = true): PdfReadingSwitch {
  const isCompanyAddonActive = createIsCompanyAddonActive({
    addons: { findByCompany: async () => ({ stored, alive }) },
  });
  const addon: Addon = 'lectura_pdf';
  return { isOn: (companyId) => isCompanyAddonActive(companyId, addon) };
}

describe('documentos — runDocumentJob con la lectura de PDF apagada', () => {
  it('R22 — apagada: termina como unauthorized definitivo, sin tanda, lector, descarga ni cadena, y nunca requeue', async () => {
    const isOn = vi.fn(async () => false);
    const t = montar({ isOn });

    const result = await t.runDocumentJob(MENSAJE);

    expect(result).toEqual({ kind: 'error' });
    expect(result.kind).not.toBe('requeue');
    expect(isOn).toHaveBeenCalledWith(EMPRESA);
    expect(t.finish).toHaveBeenCalledTimes(1);
    const [fileId, outcome] = t.finish.mock.calls[0] as [string, JobOutcome];
    expect(fileId).toBe(FILA.id);
    expect(outcome).toMatchObject({ kind: 'error', code: 'unauthorized' });
    expect(failureKind('unauthorized')).toBe('definitive');
    expect(t.readBatch).not.toHaveBeenCalled();
    expect(t.readerFor).not.toHaveBeenCalled();
    expect(t.download).not.toHaveBeenCalled();
    expect(t.remove).not.toHaveBeenCalled();
    expect(t.pipelineFor).not.toHaveBeenCalled();
  });

  it('R22 — el interruptor se consulta despues de reclamar: una fila que no se reclama no lo consulta', async () => {
    const isOn = vi.fn(async () => false);
    const t = montar({ isOn });
    t.claim.mockResolvedValueOnce(null);

    expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'skipped' });
    expect(isOn).not.toHaveBeenCalled();
    expect(t.finish).not.toHaveBeenCalled();
  });

  it('R22 — prendida: el trabajo sigue su camino y pide la tanda y el lector', async () => {
    const t = montar({ isOn: async () => true });

    await t.runDocumentJob(MENSAJE);

    expect(t.readBatch).toHaveBeenCalledTimes(1);
    expect(t.readerFor).toHaveBeenCalledTimes(1);
    const [, outcome] = t.finish.mock.calls[0] as [string, JobOutcome];
    expect(outcome).toMatchObject({ code: 'ai_provider_missing' });
  });

  it('R4 — interruptor de PDF prendido con integraciones apagado: el trabajo se descarta', async () => {
    const t = montar(interruptorDeComposicion(['lectura_pdf']));

    expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'error' });
    const [, outcome] = t.finish.mock.calls[0] as [string, JobOutcome];
    expect(outcome).toMatchObject({ kind: 'error', code: 'unauthorized' });
    expect(t.readBatch).not.toHaveBeenCalled();
    expect(t.readerFor).not.toHaveBeenCalled();
    expect(t.download).not.toHaveBeenCalled();
  });

  it('R4 — con integraciones y lectura de PDF prendidos el trabajo sigue', async () => {
    const t = montar(interruptorDeComposicion(['integraciones', 'lectura_pdf']));

    await t.runDocumentJob(MENSAJE);

    expect(t.readBatch).toHaveBeenCalledTimes(1);
    expect(t.readerFor).toHaveBeenCalledTimes(1);
  });

  it('R22 — empresa de baja con todo prendido: el trabajo se descarta', async () => {
    const t = montar(interruptorDeComposicion(['integraciones', 'lectura_pdf'], false));

    expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'error' });
    expect(t.readBatch).not.toHaveBeenCalled();
  });
});
