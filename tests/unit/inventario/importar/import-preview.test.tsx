import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONFIRM_BUTTON_TESTID,
  ERROR_FILE_BUTTON_TESTID,
  EXAMPLE_ROW_NOTICE_TESTID,
  IGNORED_COLUMNS_SUMMARY_TESTID,
  ROW_IGNORED_COLUMNS_TESTID,
  ImportPreviewSummary,
  ImportPreviewTable,
  NO_VALID_ROWS_TESTID,
  PREVIEW_DETAIL_ADD_EXISTING,
  ROW_DETAIL_TESTID,
  ROW_ISSUE_TESTID,
  ROW_STATUS_TESTID,
  IMPORT_FILE_NAME_TESTID,
  ImportResultSummary,
  PREVIEW_ACTIONS_TESTID,
  PREVIEW_CARD_TESTID,
  PREVIEW_STATUS_TONES,
  PREVIEW_SUMMARY_TESTID,
  PREVIEW_TITLE,
  PREVIEW_TOTAL_LABELS,
  PREVIEW_TOTAL_TONES,
  RESULT_STATUS_TONES,
  confirmLabel,
  duplicateLotDetail,
  previewDetailAddFileRow,
  statusFilterTestId,
  totalTestId,
} from '@/app/(private)/inventario/importar/components';

import { setupUser } from '../../../helpers/user-event';
import { FILAS_RESULTADO, FILAS_VISTA_PREVIA, resultado, vistaPrevia, vistaPreviaSinValidas } from './import-preview-fixtures';

afterEach(() => {
  cleanup();
});

function fila(rowNumber: number): HTMLElement {
  return screen.getByTestId(`data-table-row-${rowNumber}`);
}

function filasVisibles(): number[] {
  return screen
    .queryAllByTestId(/^data-table-row-\d+$/)
    .map((elemento) => Number(elemento.getAttribute('data-testid')?.replace('data-table-row-', '')));
}

function renderResumen(preview = vistaPrevia(), confirming = false) {
  const onConfirm = vi.fn<() => void>();
  const onDownloadErrors = vi.fn<() => void>();
  render(
    <ImportPreviewSummary
      preview={preview}
      confirming={confirming}
      onConfirm={onConfirm}
      onDownloadErrors={onDownloadErrors}
    />,
  );
  return { onConfirm, onDownloadErrors };
}

describe('resumen de la vista previa', () => {
  it('R9 pinta el total de filas y el de cada estado', () => {
    const preview = vistaPrevia();
    renderResumen(preview);

    expect(screen.getByTestId(totalTestId('rows'))).toHaveTextContent(String(preview.totals.rows));
    expect(screen.getByTestId(totalTestId('create'))).toHaveTextContent(String(preview.totals.create));
    expect(screen.getByTestId(totalTestId('addBatch'))).toHaveTextContent(String(preview.totals.addBatch));
    expect(screen.getByTestId(totalTestId('duplicate'))).toHaveTextContent(String(preview.totals.duplicate));
    expect(screen.getByTestId(totalTestId('error'))).toHaveTextContent(String(preview.totals.error));
  });

  it('R35 pinta la tarjeta «Vista previa» con el nombre del archivo y cada cifra como dt/dd', () => {
    const preview = vistaPrevia();
    renderResumen(preview);

    const tarjeta = screen.getByTestId(PREVIEW_CARD_TESTID);
    expect(tarjeta).toHaveAttribute('data-slot', 'card');
    expect(within(tarjeta).getByRole('heading', { level: 2 })).toHaveTextContent(PREVIEW_TITLE);
    expect(within(tarjeta).getByTestId(IMPORT_FILE_NAME_TESTID)).toHaveTextContent(preview.fileName);
    const lista = tarjeta.querySelector('dl');
    expect(lista).not.toBeNull();
    expect(lista).toHaveClass('grid-cols-[repeat(auto-fit,minmax(130px,1fr))]');
    for (const [clave, etiqueta] of Object.entries(PREVIEW_TOTAL_LABELS)) {
      const cifra = within(tarjeta).getByTestId(totalTestId(clave));
      expect(cifra.querySelector('dt')).toHaveTextContent(etiqueta);
      expect(cifra.querySelector('dd')).toHaveClass('tabular-nums');
    }
  });

  it('R36 cada cifra se pinta en el tono de su estado; «Filas» queda sin tono', () => {
    renderResumen(vistaPrevia());

    const cifra = (clave: string) => screen.getByTestId(totalTestId(clave)).querySelector('dd');
    expect(cifra('rows')).not.toHaveAttribute('data-tone');
    expect(cifra('create')).toHaveAttribute('data-tone', 'success');
    expect(cifra('create')).toHaveClass('text-success-text');
    expect(cifra('addBatch')).toHaveAttribute('data-tone', 'info');
    expect(cifra('addBatch')).toHaveClass('text-info-text');
    expect(cifra('duplicate')).toHaveAttribute('data-tone', 'waiting');
    expect(cifra('duplicate')).toHaveClass('text-warning-text');
    expect(cifra('error')).toHaveAttribute('data-tone', 'danger');
    expect(cifra('error')).toHaveClass('text-destructive-text');
    expect(PREVIEW_TOTAL_TONES).toEqual({ create: 'success', addBatch: 'info', duplicate: 'waiting', error: 'danger' });
  });

  it('R40 los botones van al final: «Descargar filas con error» e «Importar N filas válidas» con N tabular', () => {
    const preview = vistaPrevia();
    renderResumen(preview);

    const botones = screen.getByTestId(PREVIEW_ACTIONS_TESTID);
    expect(screen.getByTestId(PREVIEW_SUMMARY_TESTID).lastElementChild).toBe(botones);
    expect(botones).toHaveClass('@max-[760px]:flex-col', '@max-[760px]:items-stretch');
    const confirmar = within(botones).getByTestId(CONFIRM_BUTTON_TESTID);
    const validas = preview.totals.create + preview.totals.addBatch;
    expect(confirmar).toHaveTextContent(confirmLabel(validas));
    expect(confirmar.querySelector('span.tabular-nums')).toHaveTextContent(String(validas));
    expect(within(botones).getByTestId(ERROR_FILE_BUTTON_TESTID)).toBeInTheDocument();
  });

  it('R50 los avisos van entre las cifras y lo que sigue', () => {
    render(
      <ImportPreviewSummary
        preview={vistaPrevia({ exampleRowIgnored: true })}
        confirming={false}
        onConfirm={vi.fn()}
        onDownloadErrors={vi.fn()}
      >
        <div data-testid="lo-que-sigue" />
      </ImportPreviewSummary>,
    );

    const antes = (a: HTMLElement, b: HTMLElement) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const aviso = screen.getByTestId(EXAMPLE_ROW_NOTICE_TESTID);
    const sigue = screen.getByTestId('lo-que-sigue');
    expect(antes(screen.getByTestId(PREVIEW_CARD_TESTID), aviso)).toBe(true);
    expect(antes(aviso, sigue)).toBe(true);
    expect(antes(sigue, screen.getByTestId(PREVIEW_ACTIONS_TESTID))).toBe(true);
  });

  it('R8 avisa de que la fila de ejemplo se ignoró solo cuando vino', () => {
    renderResumen(vistaPrevia({ exampleRowIgnored: true }));
    expect(screen.getByTestId(EXAMPLE_ROW_NOTICE_TESTID)).toHaveAttribute('role', 'status');
    cleanup();

    renderResumen(vistaPrevia({ exampleRowIgnored: false }));
    expect(screen.queryByTestId(EXAMPLE_ROW_NOTICE_TESTID)).toBeNull();
  });

  it('R11 resume cuántas filas traen columnas ignoradas, solo si hay alguna', () => {
    const conIgnoradas = vistaPrevia();
    const [primera, ...resto] = conIgnoradas.rows;
    if (primera === undefined) throw new Error('fixture vacío');
    renderResumen({ ...conIgnoradas, rows: [{ ...primera, ignoredColumns: ['name'] }, ...resto] });
    expect(screen.getByTestId(IGNORED_COLUMNS_SUMMARY_TESTID)).toHaveTextContent(/^1 fila trae valores/);
    cleanup();

    renderResumen(vistaPrevia());
    expect(screen.queryByTestId(IGNORED_COLUMNS_SUMMARY_TESTID)).toBeNull();
  });

  it('R24 «Confirmar» sigue disponible con filas en error y faltantes sin crear', async () => {
    const user = setupUser();
    const { onConfirm } = renderResumen(vistaPrevia());

    const confirmar = screen.getByTestId(CONFIRM_BUTTON_TESTID);
    expect(confirmar).toBeEnabled();
    await user.click(confirmar);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(NO_VALID_ROWS_TESTID)).toBeNull();
  });

  it('R24 «Confirmar» queda deshabilitado sin ninguna fila válida', () => {
    renderResumen(vistaPreviaSinValidas());

    expect(screen.getByTestId(CONFIRM_BUTTON_TESTID)).toBeDisabled();
    expect(screen.getByTestId(NO_VALID_ROWS_TESTID)).toBeInTheDocument();
  });

  it('R24 mientras se confirma el botón está ocupado y no se puede pulsar otra vez', () => {
    renderResumen(vistaPrevia(), true);

    const confirmar = screen.getByTestId(CONFIRM_BUTTON_TESTID);
    expect(confirmar).toBeDisabled();
    expect(confirmar).toHaveAttribute('aria-busy', 'true');
  });

  it('R28 ofrece el archivo de errores solo si hay filas en error', async () => {
    const user = setupUser();
    const { onDownloadErrors } = renderResumen(vistaPrevia());

    await user.click(screen.getByTestId(ERROR_FILE_BUTTON_TESTID));
    expect(onDownloadErrors).toHaveBeenCalledTimes(1);
    cleanup();

    renderResumen(vistaPrevia({ rows: FILAS_VISTA_PREVIA.filter((f) => f.status !== 'error') }));
    expect(screen.queryByTestId(ERROR_FILE_BUTTON_TESTID)).toBeNull();
  });
});

describe('tabla de la vista previa', () => {
  it('R9 pinta cada fila con su número de fila en el orden del archivo', () => {
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    expect(filasVisibles()).toEqual(FILAS_VISTA_PREVIA.map((f) => f.rowNumber));
  });

  it('R38 cada estado de la vista previa se pinta con StatusBadge en el tono de su significado', () => {
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    const porEstado = new Map<string, string>();
    for (const f of FILAS_VISTA_PREVIA) {
      const estado = within(fila(f.rowNumber)).getByTestId(ROW_STATUS_TESTID);
      expect(estado).toHaveAttribute('data-status', f.status);
      expect(estado).toHaveAttribute('data-tone', PREVIEW_STATUS_TONES[f.status]);
      expect(estado).toHaveAttribute('data-slot', 'badge');
      expect(estado.querySelector('[data-slot="status-dot"]')).not.toBeNull();
      porEstado.set(f.status, estado.textContent ?? '');
    }

    expect(PREVIEW_STATUS_TONES).toEqual({ create: 'success', add_batch: 'info', duplicate: 'waiting', error: 'danger' });
    expect(porEstado.size).toBe(4);
    expect(new Set(porEstado.values()).size).toBe(4);
    for (const texto of porEstado.values()) expect(texto.trim()).not.toBe('');
  });

  it('R38 cada estado del resultado se pinta con StatusBadge en el tono de su significado', () => {
    render(<ImportResultSummary result={resultado()} onDownloadErrors={vi.fn()} onRestart={vi.fn()} />);

    for (const f of FILAS_RESULTADO) {
      const estado = within(fila(f.rowNumber)).getByTestId(ROW_STATUS_TESTID);
      expect(estado).toHaveAttribute('data-status', f.status);
      expect(estado).toHaveAttribute('data-tone', RESULT_STATUS_TONES[f.status]);
    }
    expect(RESULT_STATUS_TONES).toEqual({ created: 'success', batch_added: 'info', duplicate: 'waiting', error: 'danger' });
  });

  it('R39 con tarjetas, cada fila pinta su número, su estado, su producto y su detalle', () => {
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    expect(screen.getByTestId('data-table-cards')).toBeInTheDocument();
    for (const f of FILAS_VISTA_PREVIA) {
      const tarjeta = within(screen.getByTestId(`data-table-card-${f.rowNumber}`));
      expect(tarjeta.getByTestId('data-table-card-field-row')).toHaveTextContent(String(f.rowNumber));
      expect(within(tarjeta.getByTestId('data-table-card-field-status')).getByTestId(ROW_STATUS_TESTID)).toHaveAttribute(
        'data-status',
        f.status,
      );
      expect(tarjeta.getByTestId('data-table-card-field-product')).not.toBeEmptyDOMElement();
      expect(within(tarjeta.getByTestId('data-table-card-field-detail')).getByTestId(ROW_DETAIL_TESTID)).toBeInTheDocument();
    }
  });

  it('R11 una fila con columnas que su tipo no usa sigue válida y avisa cuáles se ignoraron', () => {
    const [primera, ...resto] = FILAS_VISTA_PREVIA;
    if (primera === undefined) throw new Error('fixture vacío');
    render(<ImportPreviewTable rows={[{ ...primera, ignoredColumns: ['presentation', 'formula'] }, ...resto]} />);

    const aviso = within(fila(primera.rowNumber)).getByTestId(ROW_IGNORED_COLUMNS_TESTID);
    expect(aviso).toHaveTextContent('Se ignoraron «Presentación», «Fórmula»: no aplican a este tipo.');
    expect(within(fila(primera.rowNumber)).queryByTestId(ROW_ISSUE_TESTID)).toBeNull();
  });

  it('R10 una fila en error lista cada motivo con la columna a la que apunta', () => {
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    const motivos = within(fila(7)).getAllByTestId(ROW_ISSUE_TESTID);
    expect(motivos.map((m) => m.getAttribute('data-column'))).toEqual(['unit', 'stock']);
    expect(motivos.map((m) => m.textContent)).toEqual([
      'Unidad: «Galón» no existe.',
      'Cantidad: «4,5,1» no es un número.',
    ]);
  });

  it('R20 la fila que nombra una presentación inexistente queda en error con ese motivo', () => {
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    const motivo = within(fila(8)).getByTestId(ROW_ISSUE_TESTID);
    expect(motivo).toHaveAttribute('data-code', 'presentation_not_found');
    expect(motivo).toHaveAttribute('data-column', 'presentation');
  });

  it('R14 R15 «sumar lote» dice si es sobre un producto existente o sobre el de la fila N', () => {
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    expect(within(fila(4)).getByTestId(ROW_DETAIL_TESTID)).toHaveTextContent(PREVIEW_DETAIL_ADD_EXISTING);
    expect(within(fila(6)).getByTestId(ROW_DETAIL_TESTID)).toHaveTextContent(previewDetailAddFileRow(3));
  });

  it('R18 la fila duplicada nombra el lote que ya existe', () => {
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    expect(within(fila(5)).getByTestId(ROW_DETAIL_TESTID)).toHaveTextContent(duplicateLotDetail('BA-01'));
  });

  it('R9 el filtro por estado deja solo las filas de ese estado y se puede quitar', async () => {
    const user = setupUser();
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    const error = screen.getByTestId(statusFilterTestId('error'));
    expect(error).toHaveAttribute('aria-pressed', 'false');
    await user.click(error);

    expect(error).toHaveAttribute('aria-pressed', 'true');
    expect(filasVisibles()).toEqual([7, 8]);

    await user.click(screen.getByTestId(statusFilterTestId('add_batch')));
    expect(filasVisibles()).toEqual([4, 6]);

    await user.click(screen.getByTestId(statusFilterTestId('all')));
    expect(filasVisibles()).toEqual(FILAS_VISTA_PREVIA.map((f) => f.rowNumber));
  });

  it('R39 cada opción del filtro dice cuántas filas tiene, en cifras tabulares y sin paréntesis', () => {
    render(<ImportPreviewTable rows={FILAS_VISTA_PREVIA} />);

    expect(screen.getByTestId(statusFilterTestId('all'))).toHaveTextContent(`Todas ${FILAS_VISTA_PREVIA.length}`);
    expect(screen.getByTestId(statusFilterTestId('error'))).toHaveTextContent('Error 2');
    expect(screen.getByTestId(statusFilterTestId('duplicate'))).toHaveTextContent('Duplicado 1');
    for (const opcion of ['all', 'create', 'add_batch', 'duplicate', 'error']) {
      const boton = screen.getByTestId(statusFilterTestId(opcion));
      expect(boton.textContent).not.toMatch(/[()]/);
      expect(boton.querySelector('span.tabular-nums')).not.toBeNull();
      expect(boton).toHaveAttribute('aria-pressed');
    }
  });

  it('R39 «Todas 48»: el número de filas sale en cifras tabulares en el filtro', () => {
    const muchas = Array.from({ length: 48 }, (_, indice) => ({ ...FILAS_VISTA_PREVIA[0]!, rowNumber: indice + 2 }));
    render(<ImportPreviewTable rows={muchas} />);

    const todas = screen.getByTestId(statusFilterTestId('all'));
    expect(todas).toHaveTextContent('Todas 48');
    const cifra = todas.querySelector('span.tabular-nums');
    expect(cifra).toHaveTextContent('48');
    expect(cifra).toHaveClass('font-mono');
  });

  it('pagina en el cliente sin perder filas: la tabla nunca pinta más de una página', () => {
    const muchas = Array.from({ length: 23 }, (_, indice) => ({
      ...FILAS_VISTA_PREVIA[0]!,
      rowNumber: indice + 2,
    }));
    render(<ImportPreviewTable rows={muchas} />);

    const visibles = filasVisibles();
    expect(visibles.length).toBeGreaterThan(0);
    expect(visibles.length).toBeLessThan(muchas.length);
    expect(visibles[0]).toBe(2);
  });
});
