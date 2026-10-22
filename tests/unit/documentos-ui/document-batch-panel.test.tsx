import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
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

import { FormulaBatchPanel } from '@/app/(private)/produccion/formulas/components';
import {
  DOCUMENT_BATCH_PANEL_TESTID,
  DOCUMENT_UPLOAD_INPUT_TESTID,
  DOCUMENT_UPLOAD_SUBMIT_TESTID,
  DocumentBatchPanel,
  DocumentUpload,
  MAX_REMEMBERED_BATCHES,
  PANEL_COUNT_TESTID,
  PANEL_ROW_SCOPE,
  PANEL_SUMMARY_TESTID,
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
import {
  PANEL_TITLE,
  UNKNOWN_BATCH_LABEL,
  batchLabel,
  discardBatchLabel,
  resumeBatchLabel,
} from '@/components/shared/document-upload/labels';
import { resetBatchStatusStore } from '@/components/shared/document-upload/batch-status-store';
import { errorMessage } from '@/lib/modules/errores';
import { formulaImportRoute } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';
import { batch, entry, okResponse, pdf, signedUploads } from './helpers';

const ARCHIVO_ID = '22222222-2222-4222-8222-222222222222';
const AMBITO = 'u-1:c-1';

const fetchMock = vi.fn<() => Promise<Response>>();

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
  getBatchStatusActionMock.mockResolvedValue({
    status: 'success',
    data: batch([entry({ status: 'processing' })]),
  });

  for (const { batchId } of rememberedBatches(AMBITO)) forgetBatch(AMBITO, batchId);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const HOY_14_32 = new Date(2026, 9, 21, 14, 32).getTime();
const HOY_09_12 = new Date(2026, 9, 21, 9, 12).getTime();
const AHORA = new Date(2026, 9, 21, 15, 0).getTime();

/** Dos tandas de hoy a horas distintas. Solo se finge el reloj: los temporizadores son reales. */
function recordarDosTandasDeHoy(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HOY_09_12);
  rememberBatch(AMBITO, 'tanda-manana', 'formula');
  vi.setSystemTime(HOY_14_32);
  rememberBatch(AMBITO, 'tanda-tarde', 'formula');
  vi.setSystemTime(AHORA);
}

async function elegirYSubir(): Promise<void> {
  const user = setupUser();
  await user.upload(screen.getByTestId(DOCUMENT_UPLOAD_INPUT_TESTID), [pdf('formula.pdf')]);
  await user.click(screen.getByTestId(DOCUMENT_UPLOAD_SUBMIT_TESTID));
}

function leerGuardadas(): Array<{ readonly batchId: string; readonly strategy: string }> {
  const guardado = window.localStorage.getItem(`${REMEMBERED_BATCHES_STORAGE_KEY}:${AMBITO}`);
  return guardado === null
    ? []
    : (JSON.parse(guardado) as Array<{ batchId: string; strategy: string }>);
}

describe('la memoria de tandas recordadas', () => {
  it('R5 — al encolar con exito, la tanda queda en el registro con su estrategia', async () => {
    render(<DocumentUpload strategy="formula" registryScope={AMBITO} />);
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

    render(<DocumentUpload strategy="formula" registryScope={AMBITO} />);
    await elegirYSubir();

    await waitFor(() => expect(enqueueBatchActionMock).toHaveBeenCalledTimes(1));
    expect(leerGuardadas()).toEqual([]);
  });

  it('R5, R16 — la tanda recordada sobrevive al desmontaje: el panel la encuentra despues', async () => {
    render(<DocumentUpload strategy="formula" registryScope={AMBITO} />);
    await elegirYSubir();

    await waitFor(() => expect(enqueueBatchActionMock).toHaveBeenCalledTimes(1));
    cleanup();

    render(
      <DocumentBatchPanel
        strategy="formula"
        registryScope={AMBITO}
        reviewHrefFor={formulaImportRoute}
      />,
    );

    expect(await screen.findByTestId(panelBatchTestId(0))).toBeVisible();
    expect(screen.getByTestId(rowNameTestId(0, PANEL_ROW_SCOPE))).toHaveTextContent('uno.pdf');
  });

  it('R7 — el panel solo sondea las tandas de su estrategia', async () => {
    rememberBatch(AMBITO, 'tanda-catalogo', 'catalogo');
    rememberBatch(AMBITO, 'tanda-formula', 'formula');

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    expect(await screen.findByTestId(panelBatchTestId(0))).toBeVisible();
    expect(screen.queryByTestId(panelBatchTestId(1))).toBeNull();
    await waitFor(() => expect(getBatchStatusActionMock).toHaveBeenCalledWith('tanda-formula'));
    expect(getBatchStatusActionMock).not.toHaveBeenCalledWith('tanda-catalogo');
  });

  it('R6 — pasado el tope, se descartan las tandas mas viejas', () => {
    for (let indice = 0; indice <= MAX_REMEMBERED_BATCHES; indice++) {
      rememberBatch(AMBITO, `tanda-${indice}`, 'formula');
    }

    const guardadas = rememberedBatches(AMBITO);
    expect(guardadas).toHaveLength(MAX_REMEMBERED_BATCHES);
    expect(guardadas[0]?.batchId).toBe(`tanda-${MAX_REMEMBERED_BATCHES}`);
    expect(guardadas[guardadas.length - 1]?.batchId).toBe('tanda-1');
  });
});

describe('el panel de tandas fuera de la ventana', () => {
  it('R8, R16 — con la tanda en curso muestra nombre, estado e intento N de M', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([
        entry({ id: 'a', name: 'uno.pdf', status: 'processing', attempts: 2 }),
        entry({ id: 'b', name: 'dos.pdf', status: 'queued', attempts: 0 }),
      ]),
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

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
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([
        entry({ status: 'error', errorCode: 'ai_unavailable', errorReason: 'El proveedor no respondio.' }),
      ]),
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    const mensaje = await screen.findByTestId(rowErrorTestId(0, PANEL_ROW_SCOPE));
    expect(mensaje).toHaveTextContent(errorMessage('ai_unavailable'));
    expect(screen.getByTestId(rowReasonTestId(0, PANEL_ROW_SCOPE))).toHaveTextContent(
      'El proveedor no respondio.',
    );
    expect(screen.getByTestId(panelBatchTestId(0))).toBeVisible();
  });

  it('R10 — un archivo listo ofrece el enlace a su revision', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([entry({ id: ARCHIVO_ID, name: 'uno.pdf', status: 'done', attempts: 1 })]),
    });

    render(
      <DocumentBatchPanel
        strategy="formula"
        registryScope={AMBITO}
        reviewHrefFor={formulaImportRoute}
      />,
    );

    const enlace = await screen.findByTestId(rowReviewLinkTestId(0, PANEL_ROW_SCOPE));
    expect(enlace).toHaveAttribute('href', formulaImportRoute(ARCHIVO_ID));
  });

  it('R11 — una tanda terminada se puede descartar del registro', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([entry({ status: 'done' })]),
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    expect(await screen.findByTestId(panelBatchTestId(0))).toBeVisible();

    const user = setupUser();
    await user.click(screen.getByTestId(panelDiscardTestId(0)));

    await waitFor(() => expect(screen.queryByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeNull());
    expect(rememberedBatches(AMBITO)).toEqual([]);
  });

  it('R12 — una tanda que ya no existe se muestra como desconocida y se puede descartar', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({ status: 'success', data: null });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    const aviso = await screen.findByTestId(panelMissingTestId(0));
    expect(aviso).toHaveTextContent(UNKNOWN_BATCH_LABEL);

    const user = setupUser();
    await user.click(screen.getByTestId(panelDiscardTestId(0)));

    await waitFor(() => expect(screen.queryByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeNull());
  });

  it('R14 — sin tandas recordadas el panel no se pinta', () => {
    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    expect(screen.queryByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeNull();
    expect(getBatchStatusActionMock).not.toHaveBeenCalled();
  });

  it('R13 — un error de consulta se muestra y Reanudar vuelve a sondear', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: errorMessage('unexpected'),
      reference: 'req-1',
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

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
  it('R10, R16 — FormulaBatchPanel pinta el panel con la ruta de revision de formulas', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: {
        ...batch([entry({ id: ARCHIVO_ID, name: 'uno.pdf', status: 'done' })]),
        strategy: 'formula' as const,
      },
    });

    render(<FormulaBatchPanel registryScope={AMBITO} />);

    expect(await screen.findByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeVisible();
    expect(await screen.findByTestId(rowReviewLinkTestId(0, PANEL_ROW_SCOPE))).toHaveAttribute(
      'href',
      formulaImportRoute(ARCHIVO_ID),
    );
  });
});

describe('el panel accesible y plegable', () => {
  it('R34 — cada Descartar tiene nombre unico y cada tanda se nombra por su rotulo', async () => {
    recordarDosTandasDeHoy();
    getBatchStatusActionMock.mockResolvedValue({
      status: 'success',
      data: batch([entry({ status: 'processing' })]),
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    expect(
      await screen.findByRole('listitem', { name: batchLabel(HOY_14_32, 1, AHORA) }),
    ).toBeVisible();
    expect(
      await screen.findByRole('listitem', { name: batchLabel(HOY_09_12, 1, AHORA) }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: discardBatchLabel(HOY_14_32, AHORA) }),
    ).toHaveTextContent('Descartar');
    expect(
      screen.getByRole('button', { name: discardBatchLabel(HOY_09_12, AHORA) }),
    ).toHaveTextContent('Descartar');
  });

  it('R34 — Descartar por su nombre quita solo esa tanda', async () => {
    recordarDosTandasDeHoy();

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    const user = setupUser();
    await user.click(
      await screen.findByRole('button', { name: discardBatchLabel(HOY_09_12, AHORA) }),
    );

    await waitFor(() => expect(rememberedBatches(AMBITO).map((b) => b.batchId)).toEqual([
      'tanda-tarde',
    ]));
    expect(screen.getByRole('button', { name: discardBatchLabel(HOY_14_32, AHORA) })).toBeVisible();
  });

  it('R40 — con dos tandas en error de consulta, cada Reanudar tiene un nombre unico', async () => {
    recordarDosTandasDeHoy();
    getBatchStatusActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: errorMessage('unexpected'),
      reference: 'req-1',
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    expect(
      await screen.findByRole('button', { name: resumeBatchLabel(HOY_14_32, AHORA) }),
    ).toHaveTextContent('Reanudar');
    expect(
      await screen.findByRole('button', { name: resumeBatchLabel(HOY_09_12, AHORA) }),
    ).toHaveTextContent('Reanudar');
  });

  it('R39 — arranca desplegado; plegar oculta la lista y deja titulo y control', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    const control = await screen.findByRole('button', { name: PANEL_TITLE });
    expect(control).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(panelBatchTestId(0))).toBeVisible();

    const user = setupUser();
    await user.click(control);

    await waitFor(() => expect(screen.queryByTestId(panelBatchTestId(0))).not.toBeVisible());
    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { name: PANEL_TITLE })).toBeVisible();
    expect(screen.getByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeVisible();
  });

  it('R39 — desplegar de nuevo vuelve a mostrar la lista', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    const control = await screen.findByRole('button', { name: PANEL_TITLE });
    const user = setupUser();
    await user.click(control);
    await waitFor(() => expect(control).toHaveAttribute('aria-expanded', 'false'));
    await user.click(control);

    await waitFor(() => expect(screen.getByTestId(panelBatchTestId(0))).toBeVisible());
    expect(control).toHaveAttribute('aria-expanded', 'true');
  });
});

/**
 * El almacen de sondeo recuerda las tandas terminadas o desaparecidas durante toda la carga: estos
 * casos usan tandas propias para no heredar la foto de otro caso.
 */
function responderPorTanda(respuestas: Record<string, GetBatchStatusResult>): void {
  getBatchStatusActionMock.mockImplementation(async (batchId) => {
    const respuesta = respuestas[batchId];
    if (respuesta === undefined) throw new Error(`tanda sin respuesta: ${batchId}`);
    return respuesta;
  });
}

const DESAPARECIDA: GetBatchStatusResult = { status: 'success', data: null };
const EN_PROCESO: GetBatchStatusResult = {
  status: 'success',
  data: batch([entry({ status: 'processing' })]),
};
const TERMINADA: GetBatchStatusResult = {
  status: 'success',
  data: batch([entry({ status: 'done' })]),
};
const TERMINADA_CON_ERROR: GetBatchStatusResult = {
  status: 'success',
  data: batch([entry({ id: 'a', status: 'done' }), entry({ id: 'b', status: 'error' })]),
};

describe('la cabecera del panel', () => {
  it('R41 — el contador coincide con las tandas visibles, incluidas las desconocidas', async () => {
    rememberBatch(AMBITO, 'r41-contador-catalogo', 'catalogo');
    rememberBatch(AMBITO, 'r41-contador-desconocida', 'formula');
    rememberBatch(AMBITO, 'r41-contador-en-curso', 'formula');
    rememberBatch(AMBITO, 'r41-contador-terminada', 'formula');
    responderPorTanda({
      'r41-contador-desconocida': DESAPARECIDA,
      'r41-contador-en-curso': EN_PROCESO,
      'r41-contador-terminada': TERMINADA,
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    expect(await screen.findByTestId(panelMissingTestId(2))).toBeVisible();
    expect(screen.getAllByRole('listitem', { name: /^Tanda/ })).toHaveLength(3);
    expect(screen.getByTestId(PANEL_COUNT_TESTID)).toHaveTextContent(/^3$/);
  });

  it('R41 — la cabecera muestra el resumen del estado de las tandas', async () => {
    rememberBatch(AMBITO, 'r41-resumen-con-error', 'formula');
    rememberBatch(AMBITO, 'r41-resumen-en-curso', 'formula');
    responderPorTanda({
      'r41-resumen-con-error': TERMINADA_CON_ERROR,
      'r41-resumen-en-curso': EN_PROCESO,
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    await waitFor(() =>
      expect(screen.getByTestId(PANEL_SUMMARY_TESTID)).toHaveTextContent(
        '1 en curso · 1 con errores',
      ),
    );
    expect(screen.getByTestId(PANEL_COUNT_TESTID)).toHaveTextContent(/^2$/);
  });

  it('R41 — con solo tandas terminadas o desconocidas el resumen dice «Todas terminadas»', async () => {
    rememberBatch(AMBITO, 'r41-todas-desconocida', 'formula');
    rememberBatch(AMBITO, 'r41-todas-terminada', 'formula');
    responderPorTanda({
      'r41-todas-desconocida': DESAPARECIDA,
      'r41-todas-terminada': TERMINADA,
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    await waitFor(() =>
      expect(screen.getByTestId(PANEL_SUMMARY_TESTID)).toHaveTextContent('Todas terminadas'),
    );
    expect(screen.getByTestId(PANEL_COUNT_TESTID)).toHaveTextContent(/^2$/);
  });

  it('R41 — con el panel plegado, el contador y el resumen siguen visibles', async () => {
    rememberBatch(AMBITO, 'r41-plegado', 'formula');
    responderPorTanda({ 'r41-plegado': EN_PROCESO });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    await waitFor(() =>
      expect(screen.getByTestId(PANEL_SUMMARY_TESTID)).toHaveTextContent('1 en curso'),
    );
    const user = setupUser();
    await user.click(screen.getByRole('button', { name: PANEL_TITLE }));

    await waitFor(() => expect(screen.queryByTestId(panelBatchTestId(0))).not.toBeVisible());
    expect(screen.getByTestId(PANEL_COUNT_TESTID)).toBeVisible();
    expect(screen.getByTestId(PANEL_COUNT_TESTID)).toHaveTextContent(/^1$/);
    expect(screen.getByTestId(PANEL_SUMMARY_TESTID)).toBeVisible();
    expect(screen.getByTestId(PANEL_SUMMARY_TESTID)).toHaveTextContent('1 en curso');
  });

  it('R41 — la cabecera no añade consultas: cada tanda se consulta una sola vez', async () => {
    rememberBatch(AMBITO, 'r41-consultas-terminada', 'formula');
    rememberBatch(AMBITO, 'r41-consultas-con-error', 'formula');
    responderPorTanda({
      'r41-consultas-terminada': TERMINADA,
      'r41-consultas-con-error': TERMINADA_CON_ERROR,
    });

    render(<DocumentBatchPanel strategy="formula" registryScope={AMBITO} />);

    await waitFor(() =>
      expect(screen.getByTestId(PANEL_SUMMARY_TESTID)).toHaveTextContent('1 con errores'),
    );
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(2);
    expect(getBatchStatusActionMock).toHaveBeenCalledWith('r41-consultas-terminada');
    expect(getBatchStatusActionMock).toHaveBeenCalledWith('r41-consultas-con-error');
  });
});

describe('el panel en el render del servidor', () => {
  it('R15 — renderToString da una salida vacia y al hidratar no hay aviso de hidratacion', async () => {
    rememberBatch(AMBITO, 'batch-1', 'formula');
    const panel = <DocumentBatchPanel strategy="formula" registryScope={AMBITO} />;

    const html = renderToString(panel);
    expect(html).toBe('');

    const contenedor = document.createElement('div');
    contenedor.innerHTML = html;
    document.body.appendChild(contenedor);
    const errorDeConsola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorRecuperable = vi.fn();

    const raiz = await act(async () =>
      hydrateRoot(contenedor, panel, { onRecoverableError: errorRecuperable }),
    );

    expect(await screen.findByTestId(DOCUMENT_BATCH_PANEL_TESTID)).toBeVisible();
    expect(errorRecuperable).not.toHaveBeenCalled();
    expect(errorDeConsola).not.toHaveBeenCalled();

    act(() => raiz.unmount());
    contenedor.remove();
    errorDeConsola.mockRestore();
  });
});
