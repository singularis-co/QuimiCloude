import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  EnqueueBatchResult,
  GetBatchStatusResult,
} from '@/lib/modules/documentos/adapters/driving/document-batch-actions';
import type { IssueUploadLinksResult } from '@/lib/modules/documentos/adapters/driving/document-upload-actions';
import type { DocumentFileStatus } from '@/lib/modules/documentos';

/**
 * El envoltorio de fórmulas sobre la pieza compartida de subida: fija la estrategia `formula` y
 * el href de revisión de CADA archivo, con `formulaImportRoute`.
 */

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
  FormulaBatchPanel,
  FormulaPdfUpload,
} from '@/app/(private)/produccion/formulas/components';
import {
  DOCUMENT_BATCH_PANEL_TESTID,
  DOCUMENT_UPLOAD_INPUT_TESTID,
  DOCUMENT_UPLOAD_OPEN_TESTID,
  DOCUMENT_UPLOAD_SUBMIT_TESTID,
  PANEL_ROW_SCOPE,
  forgetBatch,
  panelBatchTestId,
  rememberBatch,
  rememberedBatches,
  rowReviewLinkTestId,
  rowStatusTestId,
} from '@/components/shared/document-upload';
import {
  PANEL_TITLE,
  READ_ONLY_NOTICE,
  REVIEW_LABEL,
  discardBatchLabel,
} from '@/components/shared/document-upload/labels';
import { resetBatchStatusStore } from '@/components/shared/document-upload/batch-status-store';
import { formulaImportRoute } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';
import { batch, entry, okResponse, pdf, signedUploads } from './helpers';

const ARCHIVO_ID = '22222222-2222-4222-8222-222222222222';
const AMBITO = 'u-1:c-1';

const fetchMock = vi.fn<() => Promise<Response>>();

function tandaDeFormula(status: DocumentFileStatus) {
  return { ...batch([entry({ id: ARCHIVO_ID, path: signedUploads(1)[0]?.path, status })]), strategy: 'formula' as const };
}

beforeEach(() => {
  issueUploadLinksActionMock.mockReset();
  enqueueBatchActionMock.mockReset();
  getBatchStatusActionMock.mockReset();
  resetBatchStatusStore();
  fetchMock.mockReset();

  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(okResponse());
  issueUploadLinksActionMock.mockResolvedValue({
    status: 'success',
    data: { uploads: signedUploads(1) },
  });
  enqueueBatchActionMock.mockResolvedValue({ status: 'success', data: { batchId: 'batch-1' } });

  for (const { batchId } of rememberedBatches(AMBITO)) forgetBatch(AMBITO, batchId);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function elegirYSubir(): Promise<void> {
  const user = setupUser();
  await user.click(screen.getByTestId(DOCUMENT_UPLOAD_OPEN_TESTID));
  await user.upload(screen.getByTestId(DOCUMENT_UPLOAD_INPUT_TESTID), [pdf('formula.pdf')]);
  await user.click(screen.getByTestId(DOCUMENT_UPLOAD_SUBMIT_TESTID));
}

describe('el envoltorio de subida de formulas', () => {
  it('R5 — encola con la estrategia "formula"', async () => {
    getBatchStatusActionMock.mockResolvedValue({ status: 'success', data: tandaDeFormula('processing') });

    render(<FormulaPdfUpload registryScope={AMBITO} />);

    await elegirYSubir();

    await waitFor(() => expect(enqueueBatchActionMock).toHaveBeenCalledTimes(1));
    const [encolado] = enqueueBatchActionMock.mock.calls[0] ?? [];
    expect(encolado).toMatchObject({ strategy: 'formula' });
  });

  it('R10, R16 — en "listo" la fila de la ventana ofrece el enlace a formulaImportRoute(id)', async () => {
    getBatchStatusActionMock.mockResolvedValue({ status: 'success', data: tandaDeFormula('done') });

    render(<FormulaPdfUpload registryScope={AMBITO} />);

    await elegirYSubir();

    const enlace = await screen.findByTestId(rowReviewLinkTestId(0));
    expect(enlace).toBeVisible();
    expect(enlace).toHaveAttribute('href', formulaImportRoute(ARCHIVO_ID));
  });

  it.each<DocumentFileStatus>(['processing', 'error', 'queued'])(
    'R10 — en estado "%s" la fila no ofrece ningun enlace',
    async (status) => {
      getBatchStatusActionMock.mockResolvedValue({ status: 'success', data: tandaDeFormula(status) });

      render(<FormulaPdfUpload registryScope={AMBITO} />);

      await elegirYSubir();

      await waitFor(() => expect(getBatchStatusActionMock).toHaveBeenCalled());
      expect(screen.queryByTestId(rowReviewLinkTestId(0))).toBeNull();
    },
  );
});

describe('el panel de tandas de formulas, fuera de la ventana', () => {
  it('R17 — FormulaPdfUpload solo monta la ventana: el panel no va en las acciones', () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({ status: 'success', data: tandaDeFormula('done') });

    render(<FormulaPdfUpload registryScope={AMBITO} />);

    expect(screen.getByTestId(DOCUMENT_UPLOAD_OPEN_TESTID)).toBeVisible();
    expect(screen.queryByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeNull();
  });

  it('R17 — FormulaBatchPanel muestra solo las tandas de formula, con su ruta de revision', async () => {
    rememberBatch(AMBITO, 'tanda-catalogo', 'catalogo');
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({ status: 'success', data: tandaDeFormula('done') });

    render(<FormulaBatchPanel registryScope={AMBITO} />);

    expect(await screen.findByTestId(rowReviewLinkTestId(0, PANEL_ROW_SCOPE))).toHaveAttribute(
      'href',
      formulaImportRoute(ARCHIVO_ID),
    );
    expect(screen.queryByTestId(panelBatchTestId(1))).toBeNull();
    expect(getBatchStatusActionMock).toHaveBeenCalledWith('batch-1');
    expect(getBatchStatusActionMock).not.toHaveBeenCalledWith('tanda-catalogo');
  });

  it('R35 — con la subida deshabilitada el panel queda en solo lectura, con su aviso', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    const [recordada] = rememberedBatches(AMBITO);
    getBatchStatusActionMock.mockResolvedValue({ status: 'success', data: tandaDeFormula('done') });

    render(<FormulaBatchPanel registryScope={AMBITO} disabled />);

    const panel = await screen.findByTestId(DOCUMENT_BATCH_PANEL_TESTID);
    expect(await within(panel).findByTestId(rowStatusTestId(0, PANEL_ROW_SCOPE))).toHaveAttribute(
      'data-status',
      'done',
    );
    expect(within(panel).getByTestId(rowReviewLinkTestId(0, PANEL_ROW_SCOPE))).toHaveTextContent(
      REVIEW_LABEL,
    );
    expect(within(panel).getByText(READ_ONLY_NOTICE)).toBeVisible();

    const descartar = discardBatchLabel(recordada?.rememberedAt ?? 0, Date.now());
    const botones = within(panel)
      .getAllByRole('button')
      .map((boton) => boton.getAttribute('aria-label') ?? boton.textContent);
    expect(botones).toEqual([PANEL_TITLE, descartar]);
    expect(panel.querySelector('input[type="file"]')).toBeNull();
    expect(within(panel).queryByTestId(DOCUMENT_UPLOAD_OPEN_TESTID)).toBeNull();
  });
});
