import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// El barril arrastra el componente y, con el, las Server Actions: dobles para no montar el servidor.
vi.mock('@/lib/modules/documentos/adapters/driving/document-upload-actions', () => ({
  issueUploadLinksAction: vi.fn(),
}));
vi.mock('@/lib/modules/documentos/adapters/driving/document-batch-actions', () => ({
  enqueueBatchAction: vi.fn(),
  getBatchStatusAction: vi.fn(),
}));

import {
  BROWSER_PHASE_LABELS,
  BROWSER_PHASE_TONES,
  DOCUMENT_UPLOAD_DIALOG_TESTID,
  DOCUMENT_UPLOAD_OPEN_TESTID,
  DocumentUploadDialog,
  DocumentUploadRow,
  FILE_STATUS_LABELS,
  FILE_STATUS_TONES,
  OPEN_LABEL,
  REVIEW_LABEL,
  dialogDescription,
  rowPhaseTestId,
  rowReasonTestId,
  rowReviewLinkTestId,
  rowStatusTestId,
  type BrowserPhase,
} from '@/components/shared/document-upload';
import { CLEAR_LABEL, UNKNOWN_BATCH_LABEL } from '@/components/shared/document-upload/labels';
import { MAX_FILES_PER_BATCH, type DocumentFileStatus } from '@/lib/modules/documentos';
import type { StatusTone } from '@/lib/shared/ui/status-tone';

import { setupUser } from '../../helpers/user-event';
import { entry } from './helpers';

afterEach(() => {
  cleanup();
});

const FASES: ReadonlyArray<readonly [BrowserPhase, StatusTone]> = [
  ['pending', 'neutral'],
  ['uploading', 'progress'],
  ['uploaded', 'success'],
  ['failed', 'danger'],
];

const ESTADOS: ReadonlyArray<readonly [DocumentFileStatus, StatusTone]> = [
  ['queued', 'neutral'],
  ['processing', 'info'],
  ['done', 'success'],
  ['error', 'danger'],
];

describe('tonos de la fase y del estado de cada archivo', () => {
  it('R8: los mapas de tono cubren exactamente las cuatro fases y los cuatro estados', () => {
    expect(BROWSER_PHASE_TONES).toEqual(Object.fromEntries(FASES));
    expect(FILE_STATUS_TONES).toEqual(Object.fromEntries(ESTADOS));
  });

  it.each(FASES)('R8: la fase %s se pinta con StatusBadge en tono %s, con su testid y data-phase', (fase, tono) => {
    render(<DocumentUploadRow index={0} fileName="uno.pdf" phase={fase} entry={null} />);

    const marca = screen.getByTestId(rowPhaseTestId(0));
    expect(marca).toHaveAttribute('data-phase', fase);
    expect(marca).toHaveAttribute('data-tone', tono);
    expect(marca).toHaveTextContent(BROWSER_PHASE_LABELS[fase]);
    expect(marca.querySelector('[data-slot="status-dot"]')).not.toBeNull();
  });

  it.each(ESTADOS)('R8: el estado %s se pinta con StatusBadge en tono %s, con su testid y data-status', (estado, tono) => {
    render(
      <DocumentUploadRow index={2} fileName="dos.pdf" phase="uploaded" entry={entry({ status: estado })} />,
    );

    const marca = screen.getByTestId(rowStatusTestId(2));
    expect(marca).toHaveAttribute('data-status', estado);
    expect(marca).toHaveAttribute('data-tone', tono);
    expect(marca).toHaveTextContent(FILE_STATUS_LABELS[estado]);
  });

  it('R8: el motivo del error sigue debajo de la marca, con su texto', () => {
    render(
      <DocumentUploadRow
        index={0}
        fileName="uno.pdf"
        phase="uploaded"
        entry={entry({ status: 'error', errorReason: 'El PDF no tiene texto.' })}
      />,
    );

    const marca = screen.getByTestId(rowStatusTestId(0));
    const motivo = screen.getByTestId(rowReasonTestId(0));
    expect(motivo).toHaveTextContent('El PDF no tiene texto.');
    expect(marca.compareDocumentPosition(motivo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Revisar y el disparador', () => {
  it('R9: «Revisar» de un archivo listo es un enlace con flecha hacia delante de 44 px', () => {
    render(
      <DocumentUploadRow
        index={0}
        fileName="uno.pdf"
        phase="uploaded"
        entry={entry({ status: 'done' })}
        reviewHrefFor={(id) => `/revisar/${id}`}
      />,
    );

    const enlace = screen.getByTestId(rowReviewLinkTestId(0));
    expect(enlace.tagName).toBe('A');
    expect(enlace).toHaveAttribute('data-direction', 'forward');
    expect(enlace).toHaveTextContent(REVIEW_LABEL);
    expect(enlace.querySelector('svg')).not.toBeNull();
    expect(enlace.className).toMatch(/min-h-11/);
    expect(enlace.className).toMatch(/min-w-11/);
  });

  it('R9: el disparador lleva el icono de subida, también deshabilitado', () => {
    render(<DocumentUploadDialog strategy="formula" disabled />);

    const disparador = screen.getByTestId(DOCUMENT_UPLOAD_OPEN_TESTID);
    expect(disparador).toHaveTextContent(OPEN_LABEL);
    expect(disparador.querySelector('svg')).not.toBeNull();
    expect(disparador).toBeDisabled();
  });

  it('R7: la ventana pinta la descripción con el tope y mide hasta 640 px o el ancho visible menos 32 px', async () => {
    const user = setupUser();
    render(<DocumentUploadDialog strategy="catalogo" />);
    await user.click(screen.getByTestId(DOCUMENT_UPLOAD_OPEN_TESTID));

    const ventana = await screen.findByTestId(DOCUMENT_UPLOAD_DIALOG_TESTID);
    expect(ventana).toHaveTextContent(dialogDescription(MAX_FILES_PER_BATCH));
    expect(ventana.className).toContain('sm:max-w-[640px]');
    expect(ventana.className).toContain('max-sm:w-[calc(100vw-32px)]');
    expect(ventana.className).toContain('max-h-[calc(100dvh-32px)]');
    expect(ventana.className).toContain('overflow-y-auto');
  });
});

describe('tildes de la subida', () => {
  it('R45: «Quitar la selección» y «La tanda ya no está disponible.» con sus tildes', () => {
    expect(CLEAR_LABEL).toBe('Quitar la selección');
    expect(UNKNOWN_BATCH_LABEL).toBe('La tanda ya no está disponible.');
  });
});
