import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ALREADY_IMPORTED_TESTID,
  CHOOSE_ANOTHER_TESTID,
  CONFIRMING_LABEL,
  CONFIRM_BUTTON_TESTID,
  EXAMPLE_ROW_NOTICE_TESTID,
  IGNORED_COLUMNS_SUMMARY_TESTID,
  IMPORT_FILE_NAME_TESTID,
  IMPORT_STEPS_TESTID,
  MISSING_SECTION_TESTID,
  PREVIEW_ACTIONS_TESTID,
  PREVIEW_CARD_TESTID,
  RESULT_CARD_TESTID,
  RESULT_TABLE_TESTID,
  ROW_DETAIL_TESTID,
  ROW_IGNORED_COLUMNS_TESTID,
  TEMPLATE_BUTTON_TESTID,
  importStepTestId,
  DIALOG_SUBMIT_TESTID,
  ERROR_FILE_BUTTON_TESTID,
  InventoryImportScreen,
  MISSING_CREATE_TESTID,
  MISSING_UNIT_TESTID,
  NOTHING_IMPORTED_MESSAGE_TESTID,
  NOTHING_IMPORTED_TESTID,
  NOTHING_IMPORTED_TITLE,
  PREVIEW_TABLE_TESTID,
  REJECTION_COLUMN_TESTID,
  REJECTION_MESSAGES,
  REJECTION_TESTID,
  REJECTION_TITLE,
  RESTART_TESTID,
  RESULT_TESTID,
  RESULT_TITLE,
  REVIEWING_TESTID,
  REVIEW_BUTTON_TESTID,
  ROW_ISSUE_TESTID,
  ROW_STATUS_TESTID,
  SCREEN_ERROR_TESTID,
  UNIT_DIALOG_TESTID,
  UPLOAD_FILE_NAME_TESTID,
  UPLOAD_INPUT_TESTID,
  UPLOAD_TOO_LARGE_TESTID,
  alreadyImportedMessage,
  importedToastMessage,
  nothingImportedMessage,
} from '@/app/(private)/inventario/importar/components';
import { UNEXPECTED_ERROR_NOTICE_REFERENCE_TESTID } from '@/components/shared/unexpected-error-notice';
import {
  INVENTORY_IMPORT_MAX_FILE_BYTES,
  buildInventoryImportErrorFile,
  type ImportDownload,
  type ImportNothingImported,
  type InventoryImportPreview,
} from '@/lib/modules/inventario';
import type {
  ConfirmInventoryImportResult,
  PreviewInventoryImportResult,
} from '@/lib/modules/inventario/adapters/driving/inventory-import-actions';
import type { CreateUnitFormState } from '@/lib/modules/unidades/adapters/driving/unit-actions';

import { setupUser } from '../../../helpers/user-event';
import { FILAS_RESULTADO, FILAS_VISTA_PREVIA, resultado, vistaPrevia } from './import-preview-fixtures';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const { previewMock, confirmMock, createUnitActionMock, downloadFileMock } = vi.hoisted(() => ({
  previewMock: vi.fn<(formData: FormData) => Promise<PreviewInventoryImportResult>>(),
  confirmMock: vi.fn<(formData: FormData) => Promise<ConfirmInventoryImportResult>>(),
  createUnitActionMock: vi.fn<(prev: CreateUnitFormState, formData: FormData) => Promise<CreateUnitFormState>>(),
  downloadFileMock: vi.fn<(download: ImportDownload) => void>(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/inventory-import-actions', () => ({
  previewInventoryImportAction: previewMock,
  confirmInventoryImportAction: confirmMock,
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  createUnitAction: createUnitActionMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  createPresentationAction: vi.fn(),
}));

vi.mock('@/app/(private)/inventario/importar/components/download-file', () => ({
  downloadFile: downloadFileMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ARCHIVO = new File(['Tipo;Nombre'], 'inventario.csv', { type: 'text/csv' });

function enviado(mock: { mock: { calls: unknown[][] } }, llamada: number): FormData {
  const formData = mock.mock.calls[llamada]?.[0];
  if (!(formData instanceof FormData)) throw new Error('la acción no recibió FormData');
  return formData;
}

const FILAS_SIN_VALIDAS = FILAS_RESULTADO.filter((fila) => fila.status === 'duplicate' || fila.status === 'error');

function nadaImportado(): ImportNothingImported {
  return {
    kind: 'nothing_imported',
    fileName: 'inventario.csv',
    exampleRowIgnored: false,
    totals: { rows: 3, created: 0, batchAdded: 0, duplicate: 1, error: 2 },
    rows: FILAS_SIN_VALIDAS,
  };
}

function numerosDeFila(contenido: string): string[] {
  const { data } = Papa.parse<string[]>(contenido.replace(/^﻿/, ''), { delimiter: ';', skipEmptyLines: true });
  return data.slice(1).map((linea) => linea[0] ?? '');
}

async function subirYRevisar(archivo: File = ARCHIVO) {
  const user = setupUser();
  render(<InventoryImportScreen units={[]} />);
  await user.upload(screen.getByTestId(UPLOAD_INPUT_TESTID), archivo);
  await user.click(screen.getByTestId(REVIEW_BUTTON_TESTID));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  previewMock.mockResolvedValue({ status: 'success', data: vistaPrevia() });
  confirmMock.mockResolvedValue({ status: 'success', data: resultado() });
  createUnitActionMock.mockResolvedValue({ status: 'success', id: 'nueva' });
});

afterEach(() => {
  cleanup();
});

describe('vista previa', () => {
  it('R9 manda el archivo elegido y pinta la vista previa', async () => {
    await subirYRevisar();

    expect(await screen.findByTestId(PREVIEW_TABLE_TESTID)).toBeInTheDocument();
    expect(previewMock).toHaveBeenCalledTimes(1);
    expect(enviado(previewMock, 0).get('file')).toBe(ARCHIVO);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('sin archivo no se puede pedir la vista previa', () => {
    render(<InventoryImportScreen units={[]} />);

    expect(screen.getByTestId(REVIEW_BUTTON_TESTID)).toBeDisabled();
  });

  it('R6 un archivo que pasa del tope se avisa y no se envía', async () => {
    const user = setupUser();
    render(<InventoryImportScreen units={[]} />);
    const grande = new File([new Uint8Array(INVENTORY_IMPORT_MAX_FILE_BYTES + 1)], 'grande.csv');

    await user.upload(screen.getByTestId(UPLOAD_INPUT_TESTID), grande);

    expect(screen.getByTestId(UPLOAD_TOO_LARGE_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(REVIEW_BUTTON_TESTID)).toBeDisabled();
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('muestra el estado de carga mientras se revisa el archivo', async () => {
    let responder: (value: PreviewInventoryImportResult) => void = () => undefined;
    previewMock.mockReturnValue(new Promise((resolve) => (responder = resolve)));

    await subirYRevisar();

    expect(await screen.findByTestId(REVIEWING_TESTID)).toHaveAttribute('role', 'status');
    responder({ status: 'success', data: vistaPrevia() });
    await waitFor(() => expect(screen.queryByTestId(REVIEWING_TESTID)).toBeNull());
  });

  it('R4 R5 un archivo rechazado entero muestra el motivo y no ofrece confirmar', async () => {
    previewMock.mockResolvedValue({
      status: 'success',
      data: { kind: 'file_rejected', rejection: { code: 'missing_columns', columns: ['Cantidad'] } },
    });

    await subirYRevisar();

    const rechazo = await screen.findByTestId(REJECTION_TESTID);
    expect(within(rechazo).getByTestId(REJECTION_COLUMN_TESTID)).toHaveTextContent('Cantidad');
    expect(screen.queryByTestId(CONFIRM_BUTTON_TESTID)).toBeNull();
  });

  it('un error inesperado se pinta con su referencia', async () => {
    previewMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Algo falló.',
      reference: 'REF-PREVIEW',
    });

    await subirYRevisar();

    expect(await screen.findByTestId(SCREEN_ERROR_TESTID)).toHaveAttribute('data-code', 'unexpected');
    expect(screen.getByTestId(UNEXPECTED_ERROR_NOTICE_REFERENCE_TESTID)).toHaveTextContent('REF-PREVIEW');
  });

  it('R1 «unauthorized» se pinta con su mensaje', async () => {
    previewMock.mockResolvedValue({ status: 'error', code: 'unauthorized', message: 'Sin permiso.' });

    await subirYRevisar();

    expect(await screen.findByTestId(SCREEN_ERROR_TESTID)).toHaveTextContent('Sin permiso.');
  });

  it('R28 el archivo de errores de la vista previa sale de buildInventoryImportErrorFile', async () => {
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(ERROR_FILE_BUTTON_TESTID));

    expect(downloadFileMock).toHaveBeenCalledWith(buildInventoryImportErrorFile(FILAS_VISTA_PREVIA, 'inventario.csv'));
  });
});

describe('alta de un faltante', () => {
  it('R23 tras crear la unidad vuelve a pedir la vista previa con el MISMO archivo y pinta la nueva', async () => {
    const corregida = vistaPrevia({
      rows: FILAS_VISTA_PREVIA.filter((fila) => fila.rowNumber !== 7),
      missingUnits: [],
    });
    previewMock
      .mockResolvedValueOnce({ status: 'success', data: vistaPrevia() })
      .mockResolvedValueOnce({ status: 'success', data: corregida });
    const user = await subirYRevisar();

    await user.click(
      within(await screen.findByTestId(MISSING_UNIT_TESTID)).getByTestId(MISSING_CREATE_TESTID),
    );
    await screen.findByTestId(UNIT_DIALOG_TESTID);
    await user.click(screen.getByTestId(DIALOG_SUBMIT_TESTID));

    await waitFor(() => expect(previewMock).toHaveBeenCalledTimes(2));
    expect(enviado(previewMock, 1).get('file')).toBe(enviado(previewMock, 0).get('file'));
    expect(enviado(previewMock, 1).get('file')).toBe(ARCHIVO);
    await waitFor(() => expect(screen.queryByTestId(MISSING_UNIT_TESTID)).toBeNull());
    expect(screen.queryByTestId('data-table-row-7')).toBeNull();
  });
});

describe('confirmación', () => {
  it('R24 confirma con el mismo archivo y una importKey uuid, y pinta el resultado fila a fila', async () => {
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    const resultadoPintado = await screen.findByTestId(RESULT_TESTID);
    const formData = enviado(confirmMock, 0);
    expect(formData.get('file')).toBe(ARCHIVO);
    expect(String(formData.get('importKey'))).toMatch(UUID);
    const estados = within(within(resultadoPintado).getByRole('table'))
      .getAllByTestId(ROW_STATUS_TESTID)
      .map((estado) => estado.getAttribute('data-status'));
    expect(estados).toEqual(FILAS_RESULTADO.map((fila) => fila.status));
  });

  it('R29 un reintento tras un fallo reutiliza la misma importKey', async () => {
    confirmMock
      .mockResolvedValueOnce({ status: 'error', code: 'unexpected', message: 'Algo falló.', reference: 'REF-1' })
      .mockResolvedValueOnce({ status: 'success', data: resultado() });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));
    expect(await screen.findByTestId(UNEXPECTED_ERROR_NOTICE_REFERENCE_TESTID)).toHaveTextContent('REF-1');
    await user.click(screen.getByTestId(CONFIRM_BUTTON_TESTID));

    await screen.findByTestId(RESULT_TESTID);
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(enviado(confirmMock, 1).get('importKey')).toBe(enviado(confirmMock, 0).get('importKey'));
  });

  it('R29 una vista previa nueva estrena importKey', async () => {
    confirmMock.mockResolvedValue({ status: 'success', data: resultado() });
    const user = await subirYRevisar();
    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));
    await user.click(await screen.findByTestId(RESTART_TESTID));

    await user.upload(screen.getByTestId(UPLOAD_INPUT_TESTID), ARCHIVO);
    await user.click(screen.getByTestId(REVIEW_BUTTON_TESTID));
    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(2));
    expect(enviado(confirmMock, 1).get('importKey')).not.toBe(enviado(confirmMock, 0).get('importKey'));
  });

  it('R29 «already_imported» dice que esa importación ya se hizo', async () => {
    const importedAt = '2026-10-06T12:00:00.000Z';
    confirmMock.mockResolvedValue({
      status: 'success',
      data: { kind: 'already_imported', importId: '44444444-4444-4444-8444-444444444444', importedAt },
    });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    expect(await screen.findByTestId(ALREADY_IMPORTED_TESTID)).toHaveTextContent(alreadyImportedMessage(importedAt));
    expect(screen.queryByTestId(RESULT_TESTID)).toBeNull();
  });

  it('R25 si al confirmar el archivo se rechaza, se muestra el rechazo', async () => {
    confirmMock.mockResolvedValue({
      status: 'success',
      data: { kind: 'file_rejected', rejection: { code: 'unreadable' } },
    });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    expect(await screen.findByTestId(REJECTION_TESTID)).toHaveAttribute('data-code', 'unreadable');
  });

  it('R28 el archivo de errores del resultado sale de buildInventoryImportErrorFile', async () => {
    const user = await subirYRevisar();
    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await user.click(within(await screen.findByTestId(RESULT_TESTID)).getByTestId(ERROR_FILE_BUTTON_TESTID));

    expect(downloadFileMock).toHaveBeenCalledWith(buildInventoryImportErrorFile(FILAS_RESULTADO, 'inventario.csv'));
  });

  it('R24 nothing_imported muestra las filas con su motivo y ofrece el archivo de errores sin decir que se importo', async () => {
    confirmMock.mockResolvedValue({ status: 'success', data: nadaImportado() });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    const nada = await screen.findByTestId(NOTHING_IMPORTED_TESTID);
    expect(within(nada).getByTestId(NOTHING_IMPORTED_MESSAGE_TESTID)).toHaveTextContent(
      nothingImportedMessage('inventario.csv'),
    );
    expect(screen.queryByTestId(RESULT_TESTID)).toBeNull();
    expect(within(nada).queryByText(RESULT_TITLE)).toBeNull();
    expect(screen.queryByTestId(CONFIRM_BUTTON_TESTID)).toBeNull();
    const tabla = within(nada).getByRole('table');
    const estados = within(tabla)
      .getAllByTestId(ROW_STATUS_TESTID)
      .map((estado) => estado.getAttribute('data-status'));
    expect(estados).toEqual(['duplicate', 'error', 'error']);
    const motivos = within(tabla)
      .getAllByTestId(ROW_ISSUE_TESTID)
      .map((motivo) => motivo.textContent);
    expect(motivos).toEqual(
      FILAS_SIN_VALIDAS.flatMap((fila) => (fila.status === 'error' ? fila.issues.map((issue) => issue.message) : [])),
    );

    await user.click(within(nada).getByTestId(ERROR_FILE_BUTTON_TESTID));

    expect(downloadFileMock).toHaveBeenCalledWith(buildInventoryImportErrorFile(FILAS_SIN_VALIDAS, 'inventario.csv'));
  });

  it('R28 el archivo de errores de nothing_imported trae solo las filas en error', async () => {
    confirmMock.mockResolvedValue({ status: 'success', data: nadaImportado() });
    const user = await subirYRevisar();
    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await user.click(within(await screen.findByTestId(NOTHING_IMPORTED_TESTID)).getByTestId(ERROR_FILE_BUTTON_TESTID));

    const descarga = downloadFileMock.mock.calls[0]?.[0];
    expect(descarga).toBeDefined();
    expect(numerosDeFila(descarga?.content ?? '')).toEqual(['7', '8']);
  });

  it('R24 tras nothing_imported se puede volver a subir otro archivo', async () => {
    confirmMock.mockResolvedValue({ status: 'success', data: nadaImportado() });
    const user = await subirYRevisar();
    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await user.click(within(await screen.findByTestId(NOTHING_IMPORTED_TESTID)).getByTestId(RESTART_TESTID));

    expect(screen.queryByTestId(NOTHING_IMPORTED_TESTID)).toBeNull();
    expect(screen.getByTestId(UPLOAD_INPUT_TESTID)).toBeInTheDocument();
  });

  it('mientras confirma, el botón queda ocupado y no se puede volver a pulsar', async () => {
    let responder: (value: ConfirmInventoryImportResult) => void = () => undefined;
    confirmMock.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await waitFor(() => expect(screen.getByTestId(CONFIRM_BUTTON_TESTID)).toBeDisabled());
    expect(screen.getByTestId(CONFIRM_BUTTON_TESTID)).toHaveAttribute('aria-busy', 'true');
    responder({ status: 'success', data: resultado() });
    await screen.findByTestId(RESULT_TESTID);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });
});

describe('avisos flotantes', () => {
  it('al importar avisa con toast.success y el resumen de los totales, y deja el resumen en pantalla', async () => {
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await screen.findByTestId(RESULT_TESTID);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(importedToastMessage(resultado().totals));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('la vista previa no avisa', async () => {
    await subirYRevisar();

    await screen.findByTestId(PREVIEW_TABLE_TESTID);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('un archivo rechazado avisa con toast.error y el motivo que se pinta', async () => {
    previewMock.mockResolvedValue({
      status: 'success',
      data: { kind: 'file_rejected', rejection: { code: 'missing_columns', columns: ['Cantidad'] } },
    });

    await subirYRevisar();

    await screen.findByTestId(REJECTION_TESTID);
    expect(toast.error).toHaveBeenCalledWith(REJECTION_TITLE, {
      description: REJECTION_MESSAGES.missing_columns,
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('si la vista previa falla avisa con toast.error y el mismo mensaje que la pantalla', async () => {
    previewMock.mockResolvedValue({ status: 'error', code: 'unauthorized', message: 'Sin permiso.' });

    await subirYRevisar();

    expect(await screen.findByTestId(SCREEN_ERROR_TESTID)).toHaveTextContent('Sin permiso.');
    expect(toast.error).toHaveBeenCalledWith('Sin permiso.');
  });

  it('un error del servidor al confirmar avisa con toast.error y conserva la vista previa', async () => {
    confirmMock.mockResolvedValue({ status: 'error', code: 'unexpected', message: 'Algo falló.', reference: 'REF-1' });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await screen.findByTestId(SCREEN_ERROR_TESTID);
    expect(toast.error).toHaveBeenCalledWith('Algo falló.');
    expect(screen.getByTestId(PREVIEW_TABLE_TESTID)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('si al confirmar no se importa nada avisa con toast.error', async () => {
    confirmMock.mockResolvedValue({ status: 'success', data: nadaImportado() });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await screen.findByTestId(NOTHING_IMPORTED_TESTID);
    expect(toast.error).toHaveBeenCalledWith(NOTHING_IMPORTED_TITLE);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('una importación ya hecha avisa con toast.info', async () => {
    const importedAt = '2026-10-06T12:00:00.000Z';
    confirmMock.mockResolvedValue({
      status: 'success',
      data: { kind: 'already_imported', importId: '44444444-4444-4444-8444-444444444444', importedAt },
    });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await screen.findByTestId(ALREADY_IMPORTED_TESTID);
    expect(toast.info).toHaveBeenCalledWith(alreadyImportedMessage(importedAt));
  });
});

function pasoVigente(): string | null {
  const vigentes = within(screen.getByTestId(IMPORT_STEPS_TESTID))
    .getAllByRole('listitem')
    .filter((paso) => paso.getAttribute('aria-current') === 'step');
  expect(vigentes).toHaveLength(1);
  return vigentes[0]?.getAttribute('data-testid') ?? null;
}

/** `true` si `antes` aparece en el documento antes que `despues`. */
function vaAntes(antes: HTMLElement, despues: HTMLElement): boolean {
  return (antes.compareDocumentPosition(despues) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function conIgnoradas(): InventoryImportPreview {
  const base = vistaPrevia({ exampleRowIgnored: true });
  const [primera, ...resto] = base.rows;
  if (primera === undefined) throw new Error('fixture vacío');
  return { ...base, rows: [{ ...primera, ignoredColumns: ['formula'] }, ...resto] };
}

describe('barra de pasos', () => {
  it('R31 R32 el paso vigente va del 1 al 2 y al 3, e «Importar otro archivo» lo devuelve al 1', async () => {
    const user = setupUser();
    render(<InventoryImportScreen units={[]} />);
    expect(pasoVigente()).toBe(importStepTestId(1));

    await user.upload(screen.getByTestId(UPLOAD_INPUT_TESTID), ARCHIVO);
    expect(pasoVigente()).toBe(importStepTestId(1));
    await user.click(screen.getByTestId(REVIEW_BUTTON_TESTID));
    await screen.findByTestId(PREVIEW_TABLE_TESTID);
    expect(pasoVigente()).toBe(importStepTestId(2));

    await user.click(screen.getByTestId(CONFIRM_BUTTON_TESTID));
    await screen.findByTestId(RESULT_TESTID);
    expect(pasoVigente()).toBe(importStepTestId(3));

    await user.click(screen.getByTestId(RESTART_TESTID));
    expect(pasoVigente()).toBe(importStepTestId(1));
    expect(screen.getByTestId(UPLOAD_INPUT_TESTID)).toBeInTheDocument();
  });

  it('R32 R59 «Elegir otro archivo» del paso 2 vuelve al paso 1 sin archivo, sin vista previa, sin importar ni avisar', async () => {
    const user = await subirYRevisar();
    await screen.findByTestId(PREVIEW_TABLE_TESTID);
    expect(pasoVigente()).toBe(importStepTestId(2));

    await user.click(screen.getByTestId(CHOOSE_ANOTHER_TESTID));

    expect(pasoVigente()).toBe(importStepTestId(1));
    expect(screen.getByTestId(UPLOAD_INPUT_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(UPLOAD_FILE_NAME_TESTID)).toBeNull();
    expect(screen.getByTestId(REVIEW_BUTTON_TESTID)).toBeDisabled();
    expect(screen.queryByTestId(PREVIEW_TABLE_TESTID)).toBeNull();
    expect(screen.queryByTestId(PREVIEW_CARD_TESTID)).toBeNull();
    expect(screen.queryByTestId(SCREEN_ERROR_TESTID)).toBeNull();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(previewMock).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('R59 tras un error al confirmar, «Elegir otro archivo» también limpia el error', async () => {
    confirmMock.mockResolvedValue({ status: 'error', code: 'unauthorized', message: 'Sin permiso.' });
    const user = await subirYRevisar();
    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));
    await screen.findByTestId(SCREEN_ERROR_TESTID);
    vi.mocked(toast.error).mockClear();

    await user.click(screen.getByTestId(CHOOSE_ANOTHER_TESTID));

    expect(pasoVigente()).toBe(importStepTestId(1));
    expect(screen.queryByTestId(SCREEN_ERROR_TESTID)).toBeNull();
    expect(screen.queryByTestId(PREVIEW_TABLE_TESTID)).toBeNull();
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('R59 mientras importa, «Elegir otro archivo» queda deshabilitado', async () => {
    let responder: (value: ConfirmInventoryImportResult) => void = () => undefined;
    confirmMock.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await waitFor(() => expect(screen.getByTestId(CHOOSE_ANOTHER_TESTID)).toBeDisabled());
    responder({ status: 'success', data: resultado() });
    await screen.findByTestId(RESULT_TESTID);
  });

  it('R32 con el archivo rechazado sigue en el paso 1', async () => {
    previewMock.mockResolvedValue({
      status: 'success',
      data: { kind: 'file_rejected', rejection: { code: 'unreadable' } },
    });

    await subirYRevisar();

    await screen.findByTestId(REJECTION_TESTID);
    expect(pasoVigente()).toBe(importStepTestId(1));
  });

  it('R32 con un error del servidor al revisar sigue en el paso 1', async () => {
    previewMock.mockResolvedValue({ status: 'error', code: 'unauthorized', message: 'Sin permiso.' });

    await subirYRevisar();

    await screen.findByTestId(SCREEN_ERROR_TESTID);
    expect(pasoVigente()).toBe(importStepTestId(1));
  });

  it('R32 sin nada importado el vigente es el 3', async () => {
    confirmMock.mockResolvedValue({ status: 'success', data: nadaImportado() });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await screen.findByTestId(NOTHING_IMPORTED_TESTID);
    expect(pasoVigente()).toBe(importStepTestId(3));
  });

  it('R32 con la importación ya hecha el vigente es el 3', async () => {
    confirmMock.mockResolvedValue({
      status: 'success',
      data: {
        kind: 'already_imported',
        importId: '44444444-4444-4444-8444-444444444444',
        importedAt: '2026-10-06T12:00:00.000Z',
      },
    });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    await screen.findByTestId(ALREADY_IMPORTED_TESTID);
    expect(pasoVigente()).toBe(importStepTestId(3));
  });
});

describe('composición de los pasos', () => {
  it('R29 el paso 1 no ofrece la plantilla: vive en la cabecera de la página', () => {
    render(<InventoryImportScreen units={[]} />);

    expect(screen.queryByTestId(TEMPLATE_BUTTON_TESTID)).toBeNull();
  });

  it('R35 R40 R50 el paso 2 pinta cifras, avisos, faltantes, tabla y botones, en ese orden', async () => {
    previewMock.mockResolvedValue({ status: 'success', data: conIgnoradas() });

    await subirYRevisar();

    const orden = [
      await screen.findByTestId(PREVIEW_CARD_TESTID),
      screen.getByTestId(EXAMPLE_ROW_NOTICE_TESTID),
      screen.getByTestId(IGNORED_COLUMNS_SUMMARY_TESTID),
      screen.getByTestId(MISSING_SECTION_TESTID),
      screen.getByTestId(PREVIEW_TABLE_TESTID),
      screen.getByTestId(PREVIEW_ACTIONS_TESTID),
    ];
    for (let indice = 1; indice < orden.length; indice += 1) {
      expect(vaAntes(orden[indice - 1]!, orden[indice]!)).toBe(true);
    }
    const botones = within(screen.getByTestId(PREVIEW_ACTIONS_TESTID));
    expect(botones.getByTestId(CONFIRM_BUTTON_TESTID)).toBeInTheDocument();
    expect(botones.getByTestId(ERROR_FILE_BUTTON_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(UPLOAD_INPUT_TESTID)).toBeNull();
  });

  it('R50 el aviso de columnas ignoradas de una fila sigue en su detalle, en la tabla y en la tarjeta', async () => {
    const preview = conIgnoradas();
    previewMock.mockResolvedValue({ status: 'success', data: preview });
    const numero = preview.rows[0]?.rowNumber;

    await subirYRevisar();

    await screen.findByTestId(PREVIEW_TABLE_TESTID);
    const enFila = within(screen.getByTestId(`data-table-row-${numero}`)).getByTestId(ROW_IGNORED_COLUMNS_TESTID);
    const enTarjeta = within(screen.getByTestId(`data-table-card-${numero}`)).getByTestId(ROW_IGNORED_COLUMNS_TESTID);
    expect(enFila.closest(`[data-testid="${ROW_DETAIL_TESTID}"]`)).not.toBeNull();
    expect(enTarjeta.closest(`[data-testid="${ROW_DETAIL_TESTID}"]`)).not.toBeNull();
  });

  it('R40 mientras importa, el botón pinta el icono de carga e «Importando…»', async () => {
    let responder: (value: ConfirmInventoryImportResult) => void = () => undefined;
    confirmMock.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    const boton = screen.getByTestId(CONFIRM_BUTTON_TESTID);
    await waitFor(() => expect(boton).toHaveAttribute('aria-busy', 'true'));
    expect(boton).toHaveTextContent(CONFIRMING_LABEL);
    expect(boton.querySelector('svg')).not.toBeNull();
    responder({ status: 'success', data: resultado() });
    await screen.findByTestId(RESULT_TESTID);
  });

  it('R41 el paso 3 pinta la tarjeta del resultado con el archivo y debajo la tabla', async () => {
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    const resultadoPintado = await screen.findByTestId(RESULT_TESTID);
    const tarjeta = within(resultadoPintado).getByTestId(RESULT_CARD_TESTID);
    expect(within(tarjeta).getByRole('heading', { level: 2 })).toHaveTextContent(RESULT_TITLE);
    expect(within(tarjeta).getByTestId(IMPORT_FILE_NAME_TESTID)).toHaveTextContent('inventario.csv');
    expect(within(tarjeta).getByTestId(ERROR_FILE_BUTTON_TESTID)).toBeInTheDocument();
    expect(within(tarjeta).getByTestId(RESTART_TESTID)).toBeInTheDocument();
    expect(vaAntes(tarjeta, within(resultadoPintado).getByTestId(RESULT_TABLE_TESTID))).toBe(true);
  });

  it('R41 «Importar otro archivo» es la acción principal del paso 3', async () => {
    const user = await subirYRevisar();
    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    const reiniciar = await screen.findByTestId(RESTART_TESTID);
    expect(reiniciar.className).toContain('bg-primary');
  });

  it('R50 el paso 3 conserva el aviso de fila de ejemplo ignorada', async () => {
    confirmMock.mockResolvedValue({ status: 'success', data: resultado({ exampleRowIgnored: true }) });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    const tarjeta = await screen.findByTestId(RESULT_CARD_TESTID);
    expect(within(tarjeta).getByTestId(EXAMPLE_ROW_NOTICE_TESTID)).toBeInTheDocument();
  });

  it('R41 la importación ya hecha se pinta en el paso 3 con su texto y su reinicio', async () => {
    const importedAt = '2026-10-06T12:00:00.000Z';
    confirmMock.mockResolvedValue({
      status: 'success',
      data: { kind: 'already_imported', importId: '44444444-4444-4444-8444-444444444444', importedAt },
    });
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    const hecha = await screen.findByTestId(ALREADY_IMPORTED_TESTID);
    expect(within(hecha).getByRole('status')).toHaveTextContent(alreadyImportedMessage(importedAt));
    expect(within(hecha).getByTestId(RESTART_TESTID)).toBeInTheDocument();
  });

  it('R51 al llegar al paso 3 se avisa una sola vez y el resumen queda en pantalla', async () => {
    const user = await subirYRevisar();

    await user.click(await screen.findByTestId(CONFIRM_BUTTON_TESTID));

    const tarjeta = await screen.findByTestId(RESULT_CARD_TESTID);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(within(tarjeta).getByTestId(RESTART_TESTID)).toBeInTheDocument();
  });
});

describe('importedToastMessage', () => {
  it('resume creados y lotes sumados, en singular y plural', () => {
    expect(importedToastMessage({ created: 1, batchAdded: 2, duplicate: 0, error: 0 })).toBe(
      'Inventario importado: 1 producto creado y 2 lotes sumados.',
    );
  });

  it('añade las filas que no se importaron', () => {
    expect(importedToastMessage({ created: 3, batchAdded: 1, duplicate: 1, error: 1 })).toBe(
      'Inventario importado: 3 productos creados y 1 lote sumado. 2 filas no se importaron.',
    );
  });
});
