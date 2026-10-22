import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  EnqueueBatchResult,
  GetBatchStatusResult,
} from '@/lib/modules/documentos/adapters/driving/document-batch-actions';
import type { IssueUploadLinksResult } from '@/lib/modules/documentos/adapters/driving/document-upload-actions';

const { issueUploadLinksActionMock, enqueueBatchActionMock, getBatchStatusActionMock } = vi.hoisted(
  () => ({
    issueUploadLinksActionMock: vi.fn<(input: unknown) => Promise<IssueUploadLinksResult>>(),
    enqueueBatchActionMock: vi.fn<(input: unknown) => Promise<EnqueueBatchResult>>(),
    getBatchStatusActionMock: vi.fn<(batchId: string) => Promise<GetBatchStatusResult>>(),
  }),
);

vi.mock('@/lib/modules/documentos/adapters/driving/document-upload-actions', () => ({
  issueUploadLinksAction: issueUploadLinksActionMock,
}));

vi.mock('@/lib/modules/documentos/adapters/driving/document-batch-actions', () => ({
  enqueueBatchAction: enqueueBatchActionMock,
  getBatchStatusAction: getBatchStatusActionMock,
}));

import {
  DOCUMENT_UPLOAD_INPUT_TESTID,
  DOCUMENT_UPLOAD_SUBMIT_TESTID,
  DocumentUpload,
} from '@/components/shared/document-upload';

import { setupUser } from '../../helpers/user-event';
import { batch, entry, failedResponse, okResponse, pdf, signedUploads } from './helpers';

const fetchMock = vi.fn<(url: string) => Promise<Response>>();

beforeEach(() => {
  issueUploadLinksActionMock.mockReset();
  enqueueBatchActionMock.mockReset();
  getBatchStatusActionMock.mockReset();
  fetchMock.mockReset();

  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(okResponse());
  enqueueBatchActionMock.mockResolvedValue({ status: 'success', data: { batchId: 'batch-1' } });
  getBatchStatusActionMock.mockResolvedValue({
    status: 'success',
    data: batch([entry({ status: 'queued' })]),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function elegirYSubir(nombres: readonly string[]): Promise<void> {
  const user = setupUser();
  await user.upload(
    screen.getByTestId(DOCUMENT_UPLOAD_INPUT_TESTID),
    nombres.map((nombre) => pdf(nombre)),
  );
  await user.click(screen.getByTestId(DOCUMENT_UPLOAD_SUBMIT_TESTID));
}

describe('el nombre original de cada archivo llega al encolado', () => {
  it('R50: names va alineado con paths, en el mismo orden', async () => {
    const uploads = signedUploads(3);
    issueUploadLinksActionMock.mockResolvedValue({ status: 'success', data: { uploads } });

    render(<DocumentUpload strategy="catalogo" />);
    await elegirYSubir(['uno.pdf', 'dos.pdf', 'tres.pdf']);

    await waitFor(() => expect(enqueueBatchActionMock).toHaveBeenCalledTimes(1));
    expect(enqueueBatchActionMock).toHaveBeenCalledWith({
      strategy: 'catalogo',
      paths: uploads.map((upload) => upload.path),
      names: ['uno.pdf', 'dos.pdf', 'tres.pdf'],
    });
  });

  it('R50, R51: un archivo que falla al subir no aparece ni en paths ni en names', async () => {
    const uploads = signedUploads(3);
    issueUploadLinksActionMock.mockResolvedValue({ status: 'success', data: { uploads } });
    fetchMock.mockImplementation(async (url) =>
      url === uploads[1]?.uploadUrl ? failedResponse() : okResponse(),
    );

    render(<DocumentUpload strategy="formula" />);
    await elegirYSubir(['uno.pdf', 'dos.pdf', 'tres.pdf']);

    await waitFor(() => expect(enqueueBatchActionMock).toHaveBeenCalledTimes(1));
    expect(enqueueBatchActionMock).toHaveBeenCalledWith({
      strategy: 'formula',
      paths: [uploads[0]?.path, uploads[2]?.path],
      names: ['uno.pdf', 'tres.pdf'],
    });
  });
});
