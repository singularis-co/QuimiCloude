import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  EnqueueBatchResult,
  GetBatchStatusResult,
} from '@/lib/modules/documentos/adapters/driving/document-batch-actions';
import type { IssueUploadLinksResult } from '@/lib/modules/documentos/adapters/driving/document-upload-actions';

/**
 * La memoria de tandas recordadas y el panel que las muestra fuera de la ventana de subida: el
 * registro al encolar, el intento en curso, el resultado por archivo y el descarte.
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

import { FormulaPdfUpload } from '@/app/(private)/produccion/formulas/components';
import {
  DOCUMENT_BATCH_PANEL_TESTID,
  DOCUMENT_UPLOAD_INPUT_TESTID,
  DOCUMENT_UPLOAD_OPEN_TESTID,
  DOCUMENT_UPLOAD_SUBMIT_TESTID,
  DocumentBatchPanel,
  DocumentUpload,
  MAX_REMEMBERED_BATCHES,
  PANEL_ROW_SCOPE,
  REMEMBERED_BATCHES_STORAGE_KEY,
  forgetBatch,
  panelBatchTestId,
  panelDiscardTestId,
  panelErrorTestId,
  panelMissingTestId,
  panelResumeTestId,
  rememberBatch,
  rememberedBatches,
  rowAttemptTestId,
  rowErrorTestId,
  rowNameTestId,
  rowReasonTestId,
  rowReviewLinkTestId,
  rowStatusTestId,
} from '@/components/shared/document-upload';
import { UNKNOWN_BATCH_LABEL } from '@/components/shared/document-upload/labels';
import { errorMessage } from '@/lib/modules/errores';
import { formulaImportRoute } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';
import { batch, entry, okResponse, pdf, signedUploads } from './helpers';

const ARCHIVO_ID = '22222222-2222-4222-8222-222222222222';

const fetchMock = vi.fn<() => Promise<Response>>();

beforeEach(() => {
  issueUploadLinksActionMock.mockReset();
  enqueueBatchActionMock.mockReset();
  getBatchStatusActionMock.mockReset();
  fetchMock.mockReset();

  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(okResponse());
  issueUploadLinksActionMock.mockResolvedValue({
    status: 'success',
    data: { uploads: signedUploads(1) },
  });
  enqueueBatchActionMock.mockResolvedValue({ status: 'success', data: { batchId: 'batch-1' } });
  getBatchStatusActionMock.mockResolvedValue({
    status: 'success',
    data: batch([entry({ status: 'processing' })]),
  });

  for (const { batchId } of rememberedBatches()) forgetBatch(batchId);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function elegirYSubir(): Promise<void> {
  const user = setupUser();
  await user.upload(screen.getByTestId(DOCUMENT_UPLOAD_INPUT_TESTID), [pdf('formula.pdf')]);
  await user.click(screen.getByTestId(DOCUMENT_UPLOAD_SUBMIT_TESTID));
}

function leerGuardadas(): Array<{ readonly batchId: string; readonly strategy: string }> {
  const guardado = window.localStorage.getItem(REMEMBERED_BATCHES_STORAGE_KEY);
  return guardado === null ? [] : (JSON.parse(guardado) as Array<{ batchId: string; strategy: string }>);
}

describe('la memoria de tandas recordadas', () => {
  it('R5 — al encolar con exito, la tanda queda en el registro con su estrategia', async () => {
    render(<DocumentUpload strategy="formula" />);
    await elegirYSubir();

    await waitFor(() => expect(enqueueBatchActionMock).toHaveBeenCalledTimes(1));
    expect(leerGuardadas()).toEqual([
      expect.objectContaining({ batchId: 'batch-1', strategy: 'formula' }),
    ]);
  });

  it('R5 — un encolado que falla no deja ninguna tanda en el registro', async () => {
    enqueueBatchActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: errorMessage('unexpected'),
      reference: 'req-1',
    });

    render(<DocumentUpload strategy="formula" />);
    await elegirYSubir();

    await waitFor(() => expect(enqueueBatchActionMock).toHaveBeenCalledTimes(1));
    expect(leerGuardadas()).toEqual([]);
  });

  it('R5, R16 — la tanda recordada sobrevive al desmontaje: el panel la encuentra despues', async () => {
    render(<DocumentUpload strategy="formula" />);
    await elegirYSubir();

    await waitFor(() => expect(enqueueBatchActionMock).toHaveBeenCalledTimes(1));
    cleanup();

    render(<DocumentBatchPanel strategy="formula" reviewHrefFor={formulaImportRoute} />);

    expect(await screen.findByTestId(panelBatchTestId(0))).toBeVisible();
    expect(screen.getByTestId(rowNameTestId(0, PANEL_ROW_SCOPE))).toHaveTextContent('uno.pdf');
  });

  it('R7 — el panel solo sondea las tandas de su estrategia', async () => {
    rememberBatch('tanda-catalogo', 'catalogo');
    rememberBatch('tanda-formula', 'formula');

    render(<DocumentBatchPanel strategy="formula" />);

    expect(await screen.findByTestId(panelBatchTestId(0))).toBeVisible();
    expect(screen.queryByTestId(panelBatchTestId(1))).toBeNull();
    await waitFor(() => expect(getBatchStatusActionMock).toHaveBeenCalledWith('tanda-formula'));
    expect(getBatchStatusActionMock).not.toHaveBeenCalledWith('tanda-catalogo');
  });

  it('R6 — pasado el tope, se descartan las tandas mas viejas', () => {
    for (let indice = 0; indice <= MAX_REMEMBERED_BATCHES; indice++) {
      rememberBatch(`tanda-${indice}`, 'formula');
    }

    const guardadas = rememberedBatches();
    expect(guardadas).toHaveLength(MAX_REMEMBERED_BATCHES);
    expect(guardadas[0]?.batchId).toBe(`tanda-${MAX_REMEMBERED_BATCHES}`);
    expect(guardadas[guardadas.length - 1]?.batchId).toBe('tanda-1');
  });
});

describe('el panel de tandas fuera de la ventana', () => {
  it('R8, R16 — con la tanda en curso muestra nombre, estado e intento N de M', async () => {
    rememberBatch('batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([
        entry({ id: 'a', name: 'uno.pdf', status: 'processing', attempts: 2 }),
        entry({ id: 'b', name: 'dos.pdf', status: 'queued', attempts: 0 }),
      ]),
    });

    render(<DocumentBatchPanel strategy="formula" />);

    expect(await screen.findByTestId(rowStatusTestId(0, PANEL_ROW_SCOPE))).toHaveAttribute(
      'data-status',
      'processing',
    );
    expect(screen.getByTestId(rowNameTestId(0, PANEL_ROW_SCOPE))).toHaveTextContent('uno.pdf');
    expect(screen.getByTestId(rowAttemptTestId(0, PANEL_ROW_SCOPE))).toHaveTextContent(
      'Intento 2 de 4',
    );
    expect(screen.getByTestId(rowAttemptTestId(1, PANEL_ROW_SCOPE))).toHaveTextContent(
      'Intento 1 de 4',
    );
  });

  it('R9 — un archivo terminado en error muestra el mensaje del catalogo y su motivo, y la tanda sigue visible', async () => {
    rememberBatch('batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([
        entry({ status: 'error', errorCode: 'ai_unavailable', errorReason: 'El proveedor no respondio.' }),
      ]),
    });

    render(<DocumentBatchPanel strategy="formula" />);

    const mensaje = await screen.findByTestId(rowErrorTestId(0, PANEL_ROW_SCOPE));
    expect(mensaje).toHaveTextContent(errorMessage('ai_unavailable'));
    expect(screen.getByTestId(rowReasonTestId(0, PANEL_ROW_SCOPE))).toHaveTextContent(
      'El proveedor no respondio.',
    );
    expect(screen.getByTestId(panelBatchTestId(0))).toBeVisible();
  });

  it('R10 — un archivo listo ofrece el enlace a su revision', async () => {
    rememberBatch('batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([entry({ id: ARCHIVO_ID, name: 'uno.pdf', status: 'done', attempts: 1 })]),
    });

    render(<DocumentBatchPanel strategy="formula" reviewHrefFor={formulaImportRoute} />);

    const enlace = await screen.findByTestId(rowReviewLinkTestId(0, PANEL_ROW_SCOPE));
    expect(enlace).toHaveAttribute('href', formulaImportRoute(ARCHIVO_ID));
  });

  it('R11 — una tanda terminada se puede descartar del registro', async () => {
    rememberBatch('batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([entry({ status: 'done' })]),
    });

    render(<DocumentBatchPanel strategy="formula" />);

    expect(await screen.findByTestId(panelBatchTestId(0))).toBeVisible();

    const user = setupUser();
    await user.click(screen.getByTestId(panelDiscardTestId(0)));

    await waitFor(() => expect(screen.queryByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeNull());
    expect(rememberedBatches()).toEqual([]);
  });

  it('R12 — una tanda que ya no existe se muestra como desconocida y se puede descartar', async () => {
    rememberBatch('batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({ status: 'success', data: null });

    render(<DocumentBatchPanel strategy="formula" />);

    const aviso = await screen.findByTestId(panelMissingTestId(0));
    expect(aviso).toHaveTextContent(UNKNOWN_BATCH_LABEL);

    const user = setupUser();
    await user.click(screen.getByTestId(panelDiscardTestId(0)));

    await waitFor(() => expect(screen.queryByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeNull());
  });

  it('R14 — sin tandas recordadas el panel no se pinta', () => {
    render(<DocumentBatchPanel strategy="formula" />);

    expect(screen.queryByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeNull();
    expect(getBatchStatusActionMock).not.toHaveBeenCalled();
  });

  it('R13 — un error de consulta se muestra y Reanudar vuelve a sondear', async () => {
    rememberBatch('batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: errorMessage('unexpected'),
      reference: 'req-1',
    });

    render(<DocumentBatchPanel strategy="formula" />);

    const aviso = await screen.findByTestId(panelErrorTestId(0));
    expect(aviso).toHaveTextContent(errorMessage('unexpected'));

    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([entry({ status: 'done' })]),
    });

    const user = setupUser();
    await user.click(screen.getByTestId(panelResumeTestId(0)));

    await waitFor(() =>
      expect(screen.getByTestId(rowStatusTestId(0, PANEL_ROW_SCOPE))).toHaveAttribute(
        'data-status',
        'done',
      ),
    );
  });
});

describe('el montaje en la vista de formulas', () => {
  it('R10, R16 — FormulaPdfUpload pinta el panel junto a la ventana, con la ruta de revision de formulas', async () => {
    rememberBatch('batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: {
        ...batch([entry({ id: ARCHIVO_ID, name: 'uno.pdf', status: 'done' })]),
        strategy: 'formula' as const,
      },
    });

    render(<FormulaPdfUpload />);

    expect(screen.getByTestId(DOCUMENT_UPLOAD_OPEN_TESTID)).toBeVisible();
    expect(await screen.findByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeVisible();
    expect(await screen.findByTestId(rowReviewLinkTestId(0, PANEL_ROW_SCOPE))).toHaveAttribute(
      'href',
      formulaImportRoute(ARCHIVO_ID),
    );
  });
});