/**
 * El caso de uso del TRABAJO que entrega la cola: reclamar la fila, bajar sus bytes, procesar y
 * guardar el resultado. No recibe actor de sesion: su ambito es la empresa que salio del `claim`,
 * con permisos vacios, y esa es la unica autorizacion que necesita `downloadDocument`.
 *
 * El recorte de imagenes corre DESPUES de que el procesamiento por estrategia termine bien, y
 * SOLO para la estrategia `catalogo`: es la unica que rasteriza las paginas para mandarlas a la
 * IA, asi que es la unica que puede pedirle donde estan sus imagenes. Corre ANTES de cerrar la
 * fila para que un fallo suyo pueda dejarla en error con su motivo, y si falla el PDF NO se borra.
 *
 * El lector es el del proveedor IA de la empresa dueña del archivo, con el modelo en uso de su
 * conexión, y se pide antes de descargar: sin conexión o con la key ilegible no se baja nada.
 * Qué fallo marca la conexión y cuándo se recupera se decide aquí, al terminar.
 */
import { AiProviderError } from './errors';
import { failureKind, STORAGE_FAILURE_KIND } from './failure-kind';
import { createNotifyIfBatchFinished, type BatchFinishedDeps } from './notify-if-batch-finished';
import { createDownloadDocument } from './read-document';

import { UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';
import { marksConnection } from '@/lib/modules/integraciones';

import type { Actor } from './actor';
import type { CropCatalogImagesInput, CropCatalogImagesResult } from './crop-catalog-images';
import type { ProcessPdfByStrategyInput, StrategyRunResult } from './process-pdf-by-strategy';
import type { AiProviderGateway } from '../ports/ai-provider-gateway';
import type { AiReader } from '../ports/ai-reader';
import type {
  ClaimedFile,
  DocumentBatchRepository,
  JobOutcome,
} from '../ports/document-batch-repository';
import type { DocumentJobLog } from '../ports/document-job-log';
import type { DocumentStorage } from '../ports/document-storage';
import type { PdfReadingSwitch } from '../ports/pdf-reading-switch';

// Lo publica el contrato desde aqui, su unico consumidor de dominio: la composicion lo implementa.
export type { AiProviderGateway, AiReaderLookup } from '../ports/ai-provider-gateway';

export type RunDocumentJobMessage = {
  readonly documentFileId: string;
  readonly messageId: string;
};

/** Lo que el driving necesita para elegir el codigo HTTP de la respuesta. */
export type RunDocumentJobResult =
  | { readonly kind: 'skipped' }
  | { readonly kind: 'done' }
  | { readonly kind: 'error' }
  | { readonly kind: 'requeue' };

/** La cadena de lectura construida sobre un lector concreto. */
export type DocumentPipeline = {
  readonly processPdfByStrategy: (input: ProcessPdfByStrategyInput) => Promise<StrategyRunResult>;
  readonly cropCatalogImages: (input: CropCatalogImagesInput) => Promise<CropCatalogImagesResult>;
};

export type RunDocumentJobDeps = {
  readonly repository: DocumentBatchRepository;
  readonly storage: DocumentStorage;
  readonly aiProvider: AiProviderGateway;
  readonly pdfReading: PdfReadingSwitch;
  /** El lector depende de la empresa y del uso, así que la cadena se construye por trabajo. */
  readonly pipelineFor: (reader: AiReader) => DocumentPipeline;
  /** Opcional para que quien no observa el trabajo no tenga que pasar un doble mudo. */
  readonly log?: DocumentJobLog;
  readonly batchFinished?: BatchFinishedDeps;
};

const LOG_MUDO: DocumentJobLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function causaDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function outcomeKindOf(kind: ReturnType<typeof failureKind>): 'requeue' | 'error' {
  return kind === 'retryable' ? 'requeue' : 'error';
}

/** Deja pasar la lectura tal cual y recuerda el último fallo del proveedor que la atravesó. */
function observeProviderFailures(reader: AiReader): {
  readonly reader: AiReader;
  readonly lastFailure: () => AiProviderError | null;
} {
  let last: AiProviderError | null = null;
  return {
    reader: {
      async read(request) {
        try {
          return await reader.read(request);
        } catch (error) {
          if (error instanceof AiProviderError) last = error;
          throw error;
        }
      },
    },
    lastFailure: () => last,
  };
}

export function createRunDocumentJob(
  deps: RunDocumentJobDeps,
): (message: RunDocumentJobMessage) => Promise<RunDocumentJobResult> {
  // `downloadDocument` ya comprueba que la ruta cae bajo la empresa del ambito: reusarlo evita
  // repetir esa guardia con una comparacion propia.
  const downloadDocument = createDownloadDocument({ storage: deps.storage });
  const log = deps.log ?? LOG_MUDO;

  const notifyIfBatchFinished =
    deps.batchFinished === undefined ? null : createNotifyIfBatchFinished(deps.batchFinished);

  // El texto de un `done` es lo que leyo la IA: al registro solo va el desenlace, nunca el texto.
  async function terminar(file: ClaimedFile, outcome: JobOutcome): Promise<void> {
    const fileId = file.id;
    await deps.repository.finish(fileId, outcome);
    log.info(
      'trabajo terminado',
      outcome.kind === 'done'
        ? { fileId, outcome: outcome.kind }
        : { fileId, outcome: outcome.kind, code: outcome.code, reason: outcome.reason },
    );
    // Un `requeue` vuelve a dejar el archivo pendiente: no puede cerrar la tanda.
    if (outcome.kind !== 'requeue' && notifyIfBatchFinished !== null) {
      await notifyIfBatchFinished(file.batchId, file.companyId);
    }
  }

  // El archivo ya terminó: un fallo al informar a la conexión se avisa y no cambia su desenlace.
  async function informar(fileId: string, accion: () => Promise<void>): Promise<void> {
    try {
      await accion();
    } catch (error) {
      log.warn('informe al proveedor ia fallido', { fileId, cause: causaDe(error) });
    }
  }

  return async function runDocumentJob(
    message: RunDocumentJobMessage,
  ): Promise<RunDocumentJobResult> {
    log.info('trabajo recibido', {
      fileId: message.documentFileId,
      messageId: message.messageId,
    });
    try {
      return await ejecutar(message);
    } catch (error) {
      log.error('trabajo fallido', {
        fileId: message.documentFileId,
        operation: 'run',
        cause: causaDe(error),
      });
      throw error;
    }
  };

  async function ejecutar(message: RunDocumentJobMessage): Promise<RunDocumentJobResult> {
    const claimed = await deps.repository.claim(message.documentFileId, message.messageId);
    if (!claimed) {
      log.info('trabajo omitido: la fila no se pudo reclamar', { fileId: message.documentFileId });
      return { kind: 'skipped' };
    }
    log.info('fila reclamada', { fileId: claimed.id, batchId: claimed.batchId });

    // Lo que quedó en cola al apagar se descarta: definitivo, sin descargar ni llamar a la IA.
    if (!(await deps.pdfReading.isOn(claimed.companyId))) {
      const outcome = {
        kind: outcomeKindOf(failureKind('unauthorized')),
        code: 'unauthorized',
        reason: 'run-document-job: la lectura de PDF no esta activa en la empresa',
      } as const;
      await terminar(claimed, outcome);
      return { kind: outcome.kind };
    }

    // Permisos vacios a proposito: es el ambito minimo que `downloadDocument` necesita para
    // comprobar la empresa, sin conceder nada mas.
    const scope: Actor = { id: claimed.id, companyId: claimed.companyId, permissions: [] };

    // La estrategia es de la TANDA, no de la fila: se lee de ahi para no duplicar la columna.
    // Una fila recien reclamada sin tanda es un dato imposible, no un fallo del archivo: se trata
    // igual que un corte de almacenamiento, con `STORAGE_FAILURE_KIND`.
    const batch = await deps.repository.readBatch(claimed.batchId, claimed.companyId);
    if (!batch) {
      const outcome = {
        kind: outcomeKindOf(STORAGE_FAILURE_KIND),
        code: UNEXPECTED_ERROR_CODE,
        reason: `run-document-job: la tanda '${claimed.batchId}' no aparece tras reclamar '${claimed.id}'`,
      } as const;
      await terminar(claimed, outcome);
      return { kind: outcome.kind };
    }

    const lookup = await deps.aiProvider.readerFor(claimed.companyId);
    if (lookup.status !== 'ready') {
      // Con la key ilegible, `integraciones` ya dejó la conexión en error al resolverla.
      const code = lookup.status === 'missing' ? 'ai_provider_missing' : 'ai_provider_error';
      const outcome = {
        kind: outcomeKindOf(failureKind(code)),
        code,
        reason:
          lookup.status === 'missing'
            ? 'run-document-job: la empresa no tiene proveedor IA conectado'
            : 'run-document-job: la key guardada del proveedor IA no se pudo leer',
      } as const;
      await terminar(claimed, outcome);
      return { kind: outcome.kind };
    }
    const observado = observeProviderFailures(lookup.reader);
    const pipeline = deps.pipelineFor(observado.reader);

    const { id: fileId, companyId } = claimed;
    async function informarFallo(): Promise<void> {
      const fallo = observado.lastFailure();
      if (fallo === null || !marksConnection(fallo.failure)) return;
      await informar(fileId, () => deps.aiProvider.reportConnectionFailure(companyId, fallo.failure));
    }

    let bytes: Uint8Array;
    try {
      bytes = await downloadDocument(scope, claimed.path);
    } catch (error) {
      const outcome = {
        kind: outcomeKindOf(STORAGE_FAILURE_KIND),
        code: UNEXPECTED_ERROR_CODE,
        reason: `run-document-job: descarga fallida sobre '${claimed.path}' (${causaDe(error)})`,
      } as const;
      await terminar(claimed, outcome);
      return { kind: outcome.kind };
    }
    log.info('pdf descargado', { fileId: claimed.id, byteLength: bytes.byteLength });

    const result = await pipeline.processPdfByStrategy({
      strategy: batch.strategy,
      path: claimed.path,
      bytes,
    });
    log.info(
      'pdf procesado',
      result.ok
        ? { fileId: claimed.id, strategy: batch.strategy, ok: true, mode: result.mode }
        : {
            fileId: claimed.id,
            strategy: batch.strategy,
            ok: false,
            code: result.code,
            reason: result.reason,
          },
    );

    if (result.ok) {
      if (batch.strategy === 'catalogo') {
        const crop = await pipeline.cropCatalogImages({
          documentFileId: claimed.id,
          companyId: claimed.companyId,
          path: claimed.path,
          bytes,
        });
        if (!crop.ok) {
          const outcome = {
            kind: outcomeKindOf(failureKind(crop.code)),
            code: crop.code,
            reason: crop.reason,
          } as const;
          await terminar(claimed, outcome);
          await informarFallo();
          return { kind: outcome.kind };
        }
        log.info('imagenes recortadas', {
          fileId: claimed.id,
          uploaded: crop.uploaded,
          skipped: crop.skipped,
        });
      }

      await terminar(claimed, { kind: 'done', text: result.text });
      // La fila ya esta en `done`: propagar aqui haria reintentar a la cola un trabajo terminado
      // cuyo `claim` ya no se puede ganar. Queda un PDF huerfano, y el aviso es lo que lo delata.
      try {
        await deps.storage.remove(claimed.path);
      } catch (error) {
        log.warn('borrado final fallido', { fileId: claimed.id, cause: causaDe(error) });
      }
      if (lookup.connectionStatus === 'ERROR') {
        await informar(claimed.id, () => deps.aiProvider.reportRecovered(claimed.companyId));
      }
      return { kind: 'done' };
    }

    const outcome = {
      kind: outcomeKindOf(failureKind(result.code)),
      code: result.code,
      reason: result.reason,
    } as const;
    await terminar(claimed, outcome);
    await informarFallo();
    return { kind: outcome.kind };
  }
}
