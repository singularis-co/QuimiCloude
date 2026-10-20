// El aviso de fin de tanda visto desde `documentos`: cuándo llama al listener `runDocumentJob`,
// cuándo `getBatchStatus` tras caducar, y que un listener que lanza no cambia nada.
//
// La tanda vive en memoria: `finish` y `expireStale` cambian el estado de sus archivos y
// `readBatchNotice` lo cuenta, así que el listener ve lo mismo que vería contra la base.
import { describe, expect, it, vi } from 'vitest';

import { createGetBatchStatus } from '@/lib/modules/documentos/domain/get-batch-status';
import { createNotifyIfBatchFinished } from '@/lib/modules/documentos/domain/notify-if-batch-finished';
import { trabajoConProveedor } from './run-document-job-doubles';

import type { Actor } from '@/lib/modules/documentos/domain/actor';
import type {
  BatchFinishedEvent,
  BatchFinishedListener,
} from '@/lib/modules/documentos/domain/batch-finished-listener';
import type { DocumentFileStatus } from '@/lib/modules/documentos/domain/batch-status';
import type { StrategyRunResult } from '@/lib/modules/documentos/domain/process-pdf-by-strategy';
import type {
  BatchNotice,
  BatchNoticeReader,
  ClaimedFile,
  DocumentBatchRepository,
} from '@/lib/modules/documentos/ports/document-batch-repository';
import type { DocumentJobLog } from '@/lib/modules/documentos/ports/document-job-log';
import type { DocumentStorage } from '@/lib/modules/documentos/ports/document-storage';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const TANDA = 'tanda-1';
const AUTOR = '44444444-4444-4444-8444-444444444444';
const SUBIDA = new Date('2026-10-19T09:12:00.000Z');
const AHORA = new Date('2026-10-19T09:30:00.000Z');

type Archivo = { id: string; status: DocumentFileStatus; name: string | null };

function tandaEnMemoria(archivos: readonly Archivo[]) {
  const files = archivos.map((a) => ({ ...a }));
  const byId = (id: string) => {
    const file = files.find((f) => f.id === id);
    if (file === undefined) throw new Error(`archivo desconocido ${id}`);
    return file;
  };

  const claim = vi.fn(async (id: string): Promise<ClaimedFile | null> => {
    const file = byId(id);
    if (file.status !== 'queued') return null;
    file.status = 'processing';
    return { id, companyId: EMPRESA, batchId: TANDA, path: `${EMPRESA}/${id}.pdf` };
  });
  const finish = vi.fn<DocumentBatchRepository['finish']>(async (id, outcome) => {
    byId(id).status = outcome.kind === 'requeue' ? 'queued' : outcome.kind;
  });
  const expireStale = vi.fn<DocumentBatchRepository['expireStale']>(async () => {
    for (const file of files) {
      if (file.status === 'queued' || file.status === 'processing') file.status = 'error';
    }
  });
  const repository: DocumentBatchRepository = {
    createBatch: vi.fn(async () => {
      throw new Error('no crea tandas');
    }),
    attachMessageId: vi.fn(async () => {
      throw new Error('no anota mensajes');
    }),
    claim,
    finish,
    expireStale,
    readBatch: vi.fn(async () => ({ id: TANDA, companyId: EMPRESA, strategy: 'formula' as const, files: [] })),
    readFileForReview: vi.fn(async () => {
      throw new Error('no lee para revision');
    }),
  };

  const readBatchNotice = vi.fn(async (): Promise<BatchNotice | null> => {
    const count = (status: DocumentFileStatus) => files.filter((f) => f.status === status).length;
    return {
      strategy: 'formula',
      createdBy: AUTOR,
      uploadedAt: SUBIDA,
      total: files.length,
      done: count('done'),
      failed: count('error'),
      pending: count('queued') + count('processing'),
      failedNames: files
        .filter((f) => f.status === 'error' && f.name !== null)
        .slice(0, 3)
        .map((f) => f.name as string),
    };
  });
  const notices: BatchNoticeReader = { readBatchNotice };

  return { repository, notices, readBatchNotice, finish, files };
}

function almacenamiento(): DocumentStorage {
  return {
    createSignedUpload: vi.fn(async () => {
      throw new Error('no firma subidas');
    }),
    createSignedReadUrl: vi.fn(async () => {
      throw new Error('no firma lecturas');
    }),
    download: vi.fn(async () => new Uint8Array([1])),
    remove: vi.fn(async () => {}),
  };
}

const LEIDO: StrategyRunResult = { ok: true, strategy: 'formula', path: 'x', mode: 'pdf', text: 'texto' };
const FALLIDO: StrategyRunResult = {
  ok: false,
  strategy: 'formula',
  path: 'x',
  mode: 'pdf',
  code: 'invalid_input',
  reason: 'no se pudo leer',
};
const REINTENTABLE: StrategyRunResult = {
  ok: false,
  strategy: 'formula',
  path: 'x',
  mode: 'pdf',
  code: 'ai_unavailable',
  reason: 'la ia no responde',
};

function escucha() {
  const eventos: BatchFinishedEvent[] = [];
  const onBatchFinished = vi.fn(async (e: BatchFinishedEvent) => {
    eventos.push(e);
  });
  const listener: BatchFinishedListener = { onBatchFinished };
  return { listener, onBatchFinished, eventos };
}

function trabajo(
  tanda: ReturnType<typeof tandaEnMemoria>,
  listener: BatchFinishedListener | null,
  resultados: Record<string, StrategyRunResult>,
  log?: DocumentJobLog,
) {
  return trabajoConProveedor({
    repository: tanda.repository,
    storage: almacenamiento(),
    processPdfByStrategy: vi.fn(async ({ path }) => {
      const id = path.slice(path.lastIndexOf('/') + 1, -'.pdf'.length);
      const resultado = resultados[id];
      if (resultado === undefined) throw new Error(`sin resultado para ${id}`);
      return resultado;
    }),
    cropCatalogImages: vi.fn(async () => ({ ok: true as const, uploaded: 0, skipped: 0 })),
    ...(listener === null
      ? {}
      : { batchFinished: { notices: tanda.notices, listener, now: () => AHORA, ...(log ? { log } : {}) } }),
  });
}

function mensaje(id: string) {
  return { documentFileId: id, messageId: `msg-${id}` };
}

describe('R46: runDocumentJob avisa una sola vez, al terminar el último archivo pendiente', () => {
  it('R46: con tres archivos, el aviso sale al terminar el tercero y no con los dos primeros', async () => {
    const tanda = tandaEnMemoria([
      { id: 'a', status: 'queued', name: 'a.pdf' },
      { id: 'b', status: 'queued', name: 'b.pdf' },
      { id: 'c', status: 'queued', name: 'c.pdf' },
    ]);
    const { listener, onBatchFinished, eventos } = escucha();
    const run = trabajo(tanda, listener, { a: LEIDO, b: LEIDO, c: LEIDO });

    await run(mensaje('a'));
    await run(mensaje('b'));
    expect(onBatchFinished).not.toHaveBeenCalled();
    await run(mensaje('c'));

    expect(onBatchFinished).toHaveBeenCalledTimes(1);
    expect(eventos[0]).toEqual({
      companyId: EMPRESA,
      batchId: TANDA,
      strategy: 'formula',
      createdBy: AUTOR,
      uploadedAt: SUBIDA,
      total: 3,
      done: 3,
      failed: 0,
      failedNames: [],
      occurredAt: AHORA,
    });
  });

  it('R46: los archivos que fallan antes del último no avisan; el aviso sale con el último, sea error', async () => {
    const tanda = tandaEnMemoria([
      { id: 'a', status: 'queued', name: 'a.pdf' },
      { id: 'b', status: 'queued', name: 'b.pdf' },
      { id: 'c', status: 'queued', name: null },
    ]);
    const { listener, onBatchFinished, eventos } = escucha();
    const run = trabajo(tanda, listener, { a: FALLIDO, b: LEIDO, c: FALLIDO });

    await run(mensaje('a'));
    await run(mensaje('b'));
    expect(onBatchFinished).not.toHaveBeenCalled();
    await run(mensaje('c'));

    expect(onBatchFinished).toHaveBeenCalledTimes(1);
    expect(eventos[0]).toMatchObject({ total: 3, done: 1, failed: 2, failedNames: ['a.pdf'] });
  });

  it('R46: el último archivo terminado en done también cierra la tanda', async () => {
    const tanda = tandaEnMemoria([
      { id: 'a', status: 'error', name: 'a.pdf' },
      { id: 'b', status: 'queued', name: 'b.pdf' },
    ]);
    const { listener, onBatchFinished } = escucha();
    const run = trabajo(tanda, listener, { b: LEIDO });

    await run(mensaje('b'));

    expect(onBatchFinished).toHaveBeenCalledTimes(1);
    expect(onBatchFinished.mock.calls[0]?.[0]).toMatchObject({ done: 1, failed: 1 });
  });

  it('R46: un requeue no avisa ni consulta la tanda, aunque sea el único archivo', async () => {
    const tanda = tandaEnMemoria([{ id: 'a', status: 'queued', name: 'a.pdf' }]);
    const { listener, onBatchFinished } = escucha();
    const run = trabajo(tanda, listener, { a: REINTENTABLE });

    const resultado = await run(mensaje('a'));

    expect(resultado).toEqual({ kind: 'requeue' });
    expect(tanda.readBatchNotice).not.toHaveBeenCalled();
    expect(onBatchFinished).not.toHaveBeenCalled();
  });

  it('R46: con archivos todavía pendientes no avisa', async () => {
    const tanda = tandaEnMemoria([
      { id: 'a', status: 'queued', name: 'a.pdf' },
      { id: 'b', status: 'processing', name: 'b.pdf' },
    ]);
    const { listener, onBatchFinished } = escucha();
    const run = trabajo(tanda, listener, { a: FALLIDO });

    await run(mensaje('a'));

    expect(tanda.readBatchNotice).toHaveBeenCalledTimes(1);
    expect(onBatchFinished).not.toHaveBeenCalled();
  });

  it('R46: un claim perdido no termina nada y no avisa', async () => {
    const tanda = tandaEnMemoria([{ id: 'a', status: 'done', name: 'a.pdf' }]);
    const { listener, onBatchFinished } = escucha();
    const run = trabajo(tanda, listener, {});

    expect(await run(mensaje('a'))).toEqual({ kind: 'skipped' });
    expect(onBatchFinished).not.toHaveBeenCalled();
  });
});

describe('R7: el aviso no cambia el resultado del trabajo', () => {
  it('R7: un listener que lanza no cambia el RunDocumentJobResult, y el fallo queda en el log', async () => {
    const resultados = { a: LEIDO };
    const sinAviso = await trabajo(tandaEnMemoria([{ id: 'a', status: 'queued', name: 'a.pdf' }]), null, resultados)(
      mensaje('a'),
    );

    const tanda = tandaEnMemoria([{ id: 'a', status: 'queued', name: 'a.pdf' }]);
    const listener: BatchFinishedListener = {
      onBatchFinished: vi.fn(async () => {
        throw new Error('la bandeja no responde');
      }),
    };
    const log: DocumentJobLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const conAviso = await trabajo(tanda, listener, resultados, log)(mensaje('a'));

    expect(sinAviso).toEqual({ kind: 'done' });
    expect(conAviso).toEqual(sinAviso);
    expect(tanda.files[0]?.status).toBe('done');
    expect(listener.onBatchFinished).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith('aviso de fin de tanda fallido', {
      batchId: TANDA,
      cause: 'la bandeja no responde',
    });
    expect(log.error).not.toHaveBeenCalled();
  });

  it('R7: una lectura de la tanda que lanza tampoco cambia el resultado, también con error', async () => {
    const tanda = tandaEnMemoria([{ id: 'a', status: 'queued', name: 'a.pdf' }]);
    tanda.readBatchNotice.mockRejectedValueOnce(new Error('sin conexión'));
    const { listener, onBatchFinished } = escucha();

    const resultado = await trabajo(tanda, listener, { a: FALLIDO })(mensaje('a'));

    expect(resultado).toEqual({ kind: 'error' });
    expect(onBatchFinished).not.toHaveBeenCalled();
  });

  it('R7: notifyIfBatchFinished nunca lanza, aunque no tenga log', async () => {
    const notify = createNotifyIfBatchFinished({
      notices: {
        readBatchNotice: async () => {
          throw new Error('roto');
        },
      },
      listener: escucha().listener,
    });

    await expect(notify(TANDA, EMPRESA)).resolves.toBeUndefined();
  });
});

describe('R46: getBatchStatus avisa cuando la caducidad cierra la tanda', () => {
  const actor: Actor = { id: AUTOR, companyId: EMPRESA, permissions: ['documentos.modificar'] };
  const config = { timeoutSeconds: () => 600, maxRetries: () => 3 };

  it('R46: un archivo colgado que caduca cierra la tanda y sale un aviso con él como fallido', async () => {
    const tanda = tandaEnMemoria([
      { id: 'a', status: 'done', name: 'a.pdf' },
      { id: 'b', status: 'processing', name: 'b.pdf' },
    ]);
    const { listener, onBatchFinished, eventos } = escucha();
    const getBatchStatus = createGetBatchStatus({
      repository: tanda.repository,
      config,
      now: () => AHORA,
      batchFinished: { notices: tanda.notices, listener, now: () => AHORA },
    });

    await getBatchStatus(actor, TANDA);

    expect(onBatchFinished).toHaveBeenCalledTimes(1);
    expect(eventos[0]).toMatchObject({ total: 2, done: 1, failed: 1, failedNames: ['b.pdf'] });
  });

  it('R46: la consulta de una tanda que sigue en curso no avisa', async () => {
    const tanda = tandaEnMemoria([{ id: 'a', status: 'queued', name: 'a.pdf' }]);
    tanda.repository.expireStale = vi.fn(async () => {});
    const { listener, onBatchFinished } = escucha();
    const getBatchStatus = createGetBatchStatus({
      repository: tanda.repository,
      config,
      now: () => AHORA,
      batchFinished: { notices: tanda.notices, listener },
    });

    await getBatchStatus(actor, TANDA);

    expect(onBatchFinished).not.toHaveBeenCalled();
  });

  it('R46: la tanda de otra empresa (readBatchNotice null) no avisa', async () => {
    const tanda = tandaEnMemoria([{ id: 'a', status: 'done', name: 'a.pdf' }]);
    tanda.readBatchNotice.mockResolvedValueOnce(null);
    const { listener, onBatchFinished } = escucha();
    const getBatchStatus = createGetBatchStatus({
      repository: tanda.repository,
      config,
      batchFinished: { notices: tanda.notices, listener },
    });

    await getBatchStatus(actor, TANDA);

    expect(onBatchFinished).not.toHaveBeenCalled();
  });
});
