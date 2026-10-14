// El trabajo de la cola con el proveedor IA de la empresa: que lector pide, que hace sin conexion o
// con la key ilegible, y que le cuenta a la conexion al terminar.
//
// La cadena de lectura es un doble que LEE de verdad con el lector que recibe y traduce un
// `DocumentosError` a su codigo, igual que el dominio real: asi el observador del trabajo ve pasar
// el fallo de cuenta como lo veria en produccion.

import { describe, expect, it, vi } from 'vitest';

import { dobleDeProveedor } from './run-document-job-doubles';

import { AiProviderError, DocumentosError, ValidationError } from '@/lib/modules/documentos/domain/errors';
import { createRunDocumentJob } from '@/lib/modules/documentos/domain/run-document-job';

import type { BatchStatus } from '@/lib/modules/documentos/domain/batch-status';
import type {
  CropCatalogImagesInput,
  CropCatalogImagesResult,
} from '@/lib/modules/documentos/domain/crop-catalog-images';
import type {
  ProcessPdfByStrategyInput,
  StrategyRunResult,
} from '@/lib/modules/documentos/domain/process-pdf-by-strategy';
import type {
  AiReaderLookup,
  DocumentPipeline,
} from '@/lib/modules/documentos/domain/run-document-job';
import type { AiReader } from '@/lib/modules/documentos/ports/ai-reader';
import type {
  ClaimedFile,
  DocumentBatchRepository,
  JobOutcome,
} from '@/lib/modules/documentos/ports/document-batch-repository';
import type { DocumentJobLog } from '@/lib/modules/documentos/ports/document-job-log';
import type { DocumentStorage } from '@/lib/modules/documentos/ports/document-storage';
import type { ErrorCode } from '@/lib/modules/errores';
import type { AiProviderFailure } from '@/lib/modules/integraciones';

type Strategy = 'catalogo' | 'formula';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const ARCHIVO = 'archivo-1';
const TANDA = 'tanda-1';
const RUTA = `${EMPRESA}/documento.pdf`;
const MENSAJE = { documentFileId: ARCHIVO, messageId: 'mensaje-1' };

const KEY_RECHAZADA: AiProviderFailure = { kind: 'rejected_key', httpStatus: 401, model: null };
const SIN_CUOTA: AiProviderFailure = { kind: 'quota', httpStatus: 429, model: null };

function dobleDeRepositorio(strategy: Strategy) {
  const finish = vi.fn<DocumentBatchRepository['finish']>(async () => {});
  const claimed: ClaimedFile = { id: ARCHIVO, companyId: EMPRESA, batchId: TANDA, path: RUTA };
  const batch: BatchStatus = { id: TANDA, companyId: EMPRESA, strategy, files: [] };
  const noUsar = vi.fn(async () => {
    throw new Error('run-document-job no deberia llamar a esto');
  });
  const repository: DocumentBatchRepository = {
    createBatch: noUsar,
    attachMessageId: noUsar,
    claim: vi.fn(async () => claimed),
    finish,
    expireStale: noUsar,
    readBatch: vi.fn(async () => batch),
    readFileForReview: noUsar,
  };
  return { repository, finish };
}

function dobleDeAlmacenamiento() {
  const download = vi.fn(async (): Promise<Uint8Array> => new Uint8Array([1, 2, 3]));
  const remove = vi.fn(async (): Promise<void> => {});
  const noUsar = vi.fn(async () => {
    throw new Error('run-document-job no firma');
  });
  const storage: DocumentStorage = {
    createSignedUpload: noUsar,
    createSignedReadUrl: noUsar,
    download,
    remove,
  };
  return { storage, download, remove };
}

function dobleDeLog() {
  const warn = vi.fn();
  const log: DocumentJobLog = { info: vi.fn(), warn, error: vi.fn() };
  return { log, warn };
}

function codigoDe(error: unknown): ErrorCode {
  return error instanceof DocumentosError ? error.code : 'ai_unavailable';
}

/** Una cadena que lee con el lector recibido, como la real: procesa y, en catalogo, recorta. */
function cadenaQueLee() {
  const lectores: AiReader[] = [];
  const pipelineFor = vi.fn((reader: AiReader): DocumentPipeline => {
    lectores.push(reader);
    return {
      processPdfByStrategy: async (input: ProcessPdfByStrategyInput): Promise<StrategyRunResult> => {
        try {
          const text = await reader.read({
            prompt: 'lee',
            parts: [{ kind: 'pdf', bytes: input.bytes }],
            timeoutMs: 1000,
          });
          return { ok: true, strategy: input.strategy, path: input.path, mode: 'pdf', text };
        } catch (error) {
          return {
            ok: false,
            strategy: input.strategy,
            path: input.path,
            mode: 'pdf',
            code: codigoDe(error),
            reason: 'la lectura fallo',
          };
        }
      },
      cropCatalogImages: async (input: CropCatalogImagesInput): Promise<CropCatalogImagesResult> => {
        try {
          await reader.read({
            prompt: 'coordenadas',
            parts: [{ kind: 'image', png: input.bytes, pageNumber: 1 }],
            timeoutMs: 1000,
          });
          return { ok: true, uploaded: 0, skipped: 0 };
        } catch (error) {
          return { ok: false, code: codigoDe(error), reason: 'el recorte fallo' };
        }
      },
    };
  });
  return { pipelineFor, lectores };
}

/** Un lector que responde, en orden, lo que se le da: texto o un error que lanza. */
function lectorQue(...respuestas: (string | Error)[]) {
  const read = vi.fn(async (): Promise<string> => {
    const respuesta = respuestas.shift() ?? 'texto';
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });
  const reader: AiReader = { read };
  return { reader, read };
}

function montar(strategy: Strategy, lookup: AiReaderLookup) {
  const repo = dobleDeRepositorio(strategy);
  const almacen = dobleDeAlmacenamiento();
  const proveedor = dobleDeProveedor(lookup);
  const cadena = cadenaQueLee();
  const espia = dobleDeLog();
  const runDocumentJob = createRunDocumentJob({
    repository: repo.repository,
    storage: almacen.storage,
    aiProvider: proveedor.aiProvider,
    pipelineFor: cadena.pipelineFor,
    log: espia.log,
  });
  return { runDocumentJob, repo, almacen, proveedor, cadena, espia };
}

function terminoCon(finish: ReturnType<typeof dobleDeRepositorio>['finish']): JobOutcome {
  expect(finish).toHaveBeenCalledTimes(1);
  return finish.mock.calls[0]?.[1] as JobOutcome;
}

describe('documentos — runDocumentJob con el proveedor IA de la empresa', () => {
  describe('el lector de la empresa y del uso (R21)', () => {
    it('R21 — la estrategia `formula` pide el lector de uso `recipe` para la empresa del archivo', async () => {
      const lector = lectorQue('receta');
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'done' });
      expect(t.proveedor.readerFor).toHaveBeenCalledTimes(1);
      expect(t.proveedor.readerFor).toHaveBeenCalledWith(EMPRESA, 'recipe');
      expect(lector.read).toHaveBeenCalledTimes(1);
      expect(terminoCon(t.repo.finish)).toEqual({ kind: 'done', text: 'receta' });
    });

    it('R21 — la estrategia `catalogo` pide `catalog`, y el recorte lee con ese MISMO lector', async () => {
      const lector = lectorQue('catalogo', '{"regiones":[]}');
      const t = montar('catalogo', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'done' });
      expect(t.proveedor.readerFor).toHaveBeenCalledWith(EMPRESA, 'catalog');
      expect(t.cadena.pipelineFor).toHaveBeenCalledTimes(1);
      expect(lector.read).toHaveBeenCalledTimes(2);
    });
  });

  describe('sin conexion o con la key ilegible no se descarga ni se lee (R24, R9)', () => {
    it('R24 — sin conexion el archivo termina en error definitivo `ai_provider_missing`', async () => {
      const t = montar('formula', { status: 'missing' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'error' });
      expect(terminoCon(t.repo.finish)).toMatchObject({ kind: 'error', code: 'ai_provider_missing' });
      expect(t.almacen.download).not.toHaveBeenCalled();
      expect(t.cadena.pipelineFor).not.toHaveBeenCalled();
      expect(t.almacen.remove).not.toHaveBeenCalled();
      expect(t.proveedor.reportAccountFailure).not.toHaveBeenCalled();
      expect(t.proveedor.reportRecovered).not.toHaveBeenCalled();
    });

    it('R9 — con la key ilegible termina en error definitivo `ai_provider_error` sin llamar a nadie', async () => {
      const t = montar('catalogo', { status: 'unreadable' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'error' });
      expect(terminoCon(t.repo.finish)).toMatchObject({ kind: 'error', code: 'ai_provider_error' });
      expect(t.almacen.download).not.toHaveBeenCalled();
      expect(t.cadena.pipelineFor).not.toHaveBeenCalled();
      // `integraciones` ya marco la conexion al resolverla: aqui no se informa otra vez.
      expect(t.proveedor.reportAccountFailure).not.toHaveBeenCalled();
    });
  });

  describe('fallo de cuenta durante la lectura (R25)', () => {
    it('R25 — key rechazada: archivo en error definitivo y la conexion se informa UNA vez', async () => {
      const lector = lectorQue(new AiProviderError(KEY_RECHAZADA, 'claude messages.create respondio 401'));
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'error' });
      expect(terminoCon(t.repo.finish)).toMatchObject({ kind: 'error', code: 'ai_provider_error' });
      expect(t.proveedor.reportAccountFailure).toHaveBeenCalledTimes(1);
      expect(t.proveedor.reportAccountFailure).toHaveBeenCalledWith(EMPRESA, KEY_RECHAZADA);
      expect(t.proveedor.reportRecovered).not.toHaveBeenCalled();
      expect(t.almacen.remove).not.toHaveBeenCalled();
    });

    it('R25 — sin cuota en la peticion de coordenadas del recorte tambien marca la conexion', async () => {
      const lector = lectorQue('catalogo', new AiProviderError(SIN_CUOTA, 'genai respondio 429'));
      const t = montar('catalogo', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'error' });
      expect(terminoCon(t.repo.finish)).toMatchObject({ kind: 'error', code: 'ai_provider_error' });
      expect(t.proveedor.reportAccountFailure).toHaveBeenCalledTimes(1);
      expect(t.proveedor.reportAccountFailure).toHaveBeenCalledWith(EMPRESA, SIN_CUOTA);
    });

    it('R25 — el observador relanza el MISMO error: la cadena ve el fallo intacto', async () => {
      const error = new AiProviderError(KEY_RECHAZADA);
      const lector = lectorQue(error);
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });
      await t.runDocumentJob(MENSAJE);

      const observado = t.cadena.lectores[0] as AiReader;
      expect(observado).not.toBe(lector.reader);
      lector.read.mockRejectedValueOnce(error);
      await expect(observado.read({ prompt: 'p', parts: [], timeoutMs: 1 })).rejects.toBe(error);
    });
  });

  describe('lo que no es fallo de cuenta no toca la conexion (R26)', () => {
    it('R26 — un corte del proveedor sigue siendo `ai_unavailable` reintentable y no se informa', async () => {
      const lector = lectorQue(new Error('503 del proveedor'));
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'requeue' });
      expect(terminoCon(t.repo.finish)).toMatchObject({ kind: 'requeue', code: 'ai_unavailable' });
      expect(t.proveedor.reportAccountFailure).not.toHaveBeenCalled();
      expect(t.proveedor.reportRecovered).not.toHaveBeenCalled();
    });

    it('R26 — un PDF ilegible (`invalid_input`) termina como hoy y no se informa', async () => {
      const lector = lectorQue(new ValidationError('pdf ilegible'));
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ERROR' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'error' });
      expect(terminoCon(t.repo.finish)).toMatchObject({ kind: 'error', code: 'invalid_input' });
      expect(t.proveedor.reportAccountFailure).not.toHaveBeenCalled();
      expect(t.proveedor.reportRecovered).not.toHaveBeenCalled();
    });

    it('R26 — un `AiProviderError` que no es de cuenta (modelo no disponible) no marca la conexion', async () => {
      const lector = lectorQue(
        new AiProviderError({ kind: 'model_unavailable', httpStatus: 404, model: 'm' }),
      );
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });

      await t.runDocumentJob(MENSAJE);
      expect(t.proveedor.reportAccountFailure).not.toHaveBeenCalled();
    });
  });

  describe('recuperacion y conexion en error (R27, R28)', () => {
    it('R27, R28 — con la conexion en `ERROR` se lee igual y una lectura buena la recupera', async () => {
      const lector = lectorQue('receta');
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ERROR' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'done' });
      expect(lector.read).toHaveBeenCalledTimes(1);
      expect(t.proveedor.reportRecovered).toHaveBeenCalledTimes(1);
      expect(t.proveedor.reportRecovered).toHaveBeenCalledWith(EMPRESA);
      expect(t.proveedor.reportAccountFailure).not.toHaveBeenCalled();
    });

    it('R27 — con la conexion `ACTIVE` una lectura buena no informa nada', async () => {
      const lector = lectorQue('receta');
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });

      await t.runDocumentJob(MENSAJE);
      expect(t.proveedor.reportRecovered).not.toHaveBeenCalled();
    });

    it('R27 — en `ERROR`, si el recorte falla el archivo no termina bien y no se recupera', async () => {
      const lector = lectorQue('catalogo', new Error('timeout'));
      const t = montar('catalogo', { status: 'ready', reader: lector.reader, connectionStatus: 'ERROR' });

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'requeue' });
      expect(t.proveedor.reportRecovered).not.toHaveBeenCalled();
    });
  });

  describe('un fallo al informar no cambia el desenlace', () => {
    it('R25 — si informar el fallo de cuenta revienta, el archivo sigue en error y queda un aviso', async () => {
      const lector = lectorQue(new AiProviderError(KEY_RECHAZADA));
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ACTIVE' });
      t.proveedor.reportAccountFailure.mockRejectedValueOnce(new Error('base caida'));

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'error' });
      expect(terminoCon(t.repo.finish)).toMatchObject({ kind: 'error', code: 'ai_provider_error' });
      expect(t.espia.warn).toHaveBeenCalledWith('informe al proveedor ia fallido', {
        fileId: ARCHIVO,
        cause: 'base caida',
      });
    });

    it('R27 — si informar la recuperacion revienta, el archivo sigue `done` y el PDF se borro', async () => {
      const lector = lectorQue('receta');
      const t = montar('formula', { status: 'ready', reader: lector.reader, connectionStatus: 'ERROR' });
      t.proveedor.reportRecovered.mockRejectedValueOnce(new Error('base caida'));

      expect(await t.runDocumentJob(MENSAJE)).toEqual({ kind: 'done' });
      expect(t.almacen.remove).toHaveBeenCalledTimes(1);
      expect(t.espia.warn).toHaveBeenCalledTimes(1);
    });
  });
});
