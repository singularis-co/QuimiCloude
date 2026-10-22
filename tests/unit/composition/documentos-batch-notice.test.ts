// Cómo ata la composición el fin de tanda de `documentos` a `notificaciones.notify`. Se observan
// las dependencias con las que se construyen `runDocumentJob` y `getBatchStatus`, sin Postgres.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BatchFinishedEvent } from '@/lib/modules/documentos/domain/batch-finished-listener';
import type { BatchFinishedDeps } from '@/lib/modules/documentos/domain/notify-if-batch-finished';

const { wired } = vi.hoisted(() => ({
  wired: {
    runDocumentJob: undefined as BatchFinishedDeps | undefined,
    getBatchStatus: undefined as BatchFinishedDeps | undefined,
  },
}));

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/modules/documentos', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/modules/documentos')>();
  return {
    ...real,
    createRunDocumentJob: (deps: Parameters<typeof real.createRunDocumentJob>[0]) => {
      wired.runDocumentJob = deps.batchFinished;
      return real.createRunDocumentJob(deps);
    },
    createGetBatchStatus: (deps: Parameters<typeof real.createGetBatchStatus>[0]) => {
      wired.getBatchStatus = deps.batchFinished;
      return real.createGetBatchStatus(deps);
    },
  };
});

const { notificaciones } = await import('@/lib/composition');
const { documentBatchRepositoryPrisma } = await import(
  '@/lib/modules/documentos/adapters/driven/persistence/document-batch-repository-prisma'
);

const COMPANY = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const BATCH = '2b9d4e6f-1a3c-4d5e-8f7a-9b0c1d2e3f4a';
const AUTHOR = '0b6f3d1e-2c4a-4e8b-9d7f-1a2b3c4d5e6f';
const UPLOADED_AT = new Date('2026-10-19T09:12:00.000Z');

function event(overrides: Partial<BatchFinishedEvent> = {}): BatchFinishedEvent {
  return {
    companyId: COMPANY,
    batchId: BATCH,
    strategy: 'catalogo',
    createdBy: AUTHOR,
    uploadedAt: UPLOADED_AT,
    total: 4,
    done: 2,
    failed: 2,
    failedNames: ['a.pdf'],
    occurredAt: new Date('2026-10-19T09:30:00.000Z'),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('documentos → notificaciones, cableado en composición', () => {
  it('R46: runDocumentJob y getBatchStatus reciben el mismo aviso, que lee la tanda con el repositorio de Prisma', () => {
    expect(wired.runDocumentJob).toBeDefined();
    expect(wired.getBatchStatus).toBe(wired.runDocumentJob);
    expect(wired.runDocumentJob?.notices).toBe(documentBatchRepositoryPrisma);
  });

  it('R5: el aviso de fin de tanda se emite con la clave del evento y el dedupeKey de la tanda', async () => {
    const notify = vi.spyOn(notificaciones, 'notify').mockResolvedValue(undefined);

    await wired.runDocumentJob!.listener.onBatchFinished(event());

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({
      key: 'documentos.tanda_terminada',
      companyId: COMPANY,
      dedupeKey: `documentos.tanda_terminada:${BATCH}`,
      payload: {
        recipientUserId: AUTHOR,
        strategy: 'catalogo',
        uploadedAt: UPLOADED_AT,
        total: 4,
        done: 2,
        failed: 2,
        failedNames: ['a.pdf'],
      },
    });
  });

  it('R49: el payload que llega a notify no lleva proveedor', async () => {
    const notify = vi.spyOn(notificaciones, 'notify').mockResolvedValue(undefined);

    await wired.runDocumentJob!.listener.onBatchFinished(event());

    const payload = notify.mock.calls[0]?.[0].payload as Record<string, unknown>;
    expect(Object.keys(payload).filter((k) => /supplier|proveedor/i.test(k))).toEqual([]);
  });

  it('R48: sin autor no se llama a notify y queda en el log', async () => {
    const notify = vi.spyOn(notificaciones, 'notify').mockResolvedValue(undefined);
    const warn = vi.spyOn(wired.runDocumentJob!.log!, 'warn');

    await wired.runDocumentJob!.listener.onBatchFinished(event({ createdBy: null }));

    expect(notify).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('batch_notice_without_author', { batchId: BATCH, companyId: COMPANY });
  });

  it('R5: ningún archivo de lib/modules/documentos importa @/lib/modules/notificaciones', () => {
    const root = join(process.cwd(), 'lib', 'modules', 'documentos');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name)) files.push(path);
      }
    };
    walk(root);

    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((file) => /['"]@\/lib\/modules\/notificaciones/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
