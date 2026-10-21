'use client';

import { useId } from 'react';

import { Button } from '@/components/ui/button';
import type { PdfStrategy } from '@/lib/modules/documentos';

import { forgetBatch, type RememberedBatch } from './batch-memory';
import { DocumentUploadRow } from './document-upload-row';
import {
  DISCARD_BATCH_LABEL,
  PANEL_BATCH_LABEL,
  PANEL_TITLE,
  RESUME_LABEL,
  UNKNOWN_BATCH_LABEL,
} from './labels';
import { useBatchStatus } from './use-batch-status';
import { useRememberedBatches } from './use-remembered-batches';

export const DOCUMENT_BATCH_PANEL_TESTID = 'document-upload-panel';

/** El `scope` de las filas del panel: no comparten `data-testid` con las de la ventana. */
export const PANEL_ROW_SCOPE = 'document-upload-panel';

export const panelBatchTestId = (index: number): string => `document-upload-panel-batch-${index}`;
export const panelDiscardTestId = (index: number): string =>
  `document-upload-panel-discard-${index}`;
export const panelMissingTestId = (index: number): string =>
  `document-upload-panel-missing-${index}`;
export const panelErrorTestId = (index: number): string => `document-upload-panel-error-${index}`;
export const panelResumeTestId = (index: number): string =>
  `document-upload-panel-resume-${index}`;

export type DocumentBatchPanelProps = {
  /** Solo se muestran las tandas recordadas de esta estrategia. */
  readonly strategy: PdfStrategy;
  /** Opcional: se pasa tal cual a cada fila. */
  readonly reviewHrefFor?: (documentFileId: string) => string;
  /** La pantalla ya decidio si esto se pinta: deshabilitado, no se muestra nada. */
  readonly disabled?: boolean;
};

type PanelBatchProps = {
  readonly remembered: RememberedBatch;
  readonly index: number;
  readonly reviewHrefFor?: (documentFileId: string) => string;
};

function PanelBatch({ remembered, index, reviewHrefFor }: PanelBatchProps) {
  const { status, error, missing, resume } = useBatchStatus(remembered.batchId);

  return (
    <li
      data-testid={panelBatchTestId(index)}
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{PANEL_BATCH_LABEL}</span>
        <Button
          type="button"
          variant="ghost"
          touch
          className="text-base"
          data-testid={panelDiscardTestId(index)}
          onClick={() => forgetBatch(remembered.batchId)}
        >
          {DISCARD_BATCH_LABEL}
        </Button>
      </div>

      {missing ? (
        <p data-testid={panelMissingTestId(index)} role="status" className="text-base">
          {UNKNOWN_BATCH_LABEL}
        </p>
      ) : null}

      {error !== null ? (
        <p data-testid={panelErrorTestId(index)} role="alert" className="text-base">
          {error.message}
        </p>
      ) : null}

      {error !== null ? (
        <Button
          type="button"
          variant="outline"
          touch
          className="text-base"
          data-testid={panelResumeTestId(index)}
          onClick={resume}
        >
          {RESUME_LABEL}
        </Button>
      ) : null}

      {status !== null ? (
        <ul className="flex flex-col">
          {status.files.map((entry, fileIndex) => (
            <DocumentUploadRow
              key={entry.id}
              index={fileIndex}
              fileName={entry.name}
              entry={entry}
              maxAttempts={status.maxAttempts}
              scope={PANEL_ROW_SCOPE}
              reviewHrefFor={reviewHrefFor}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Las tandas recordadas, fuera de la ventana de subida: cada una con el estado de cada archivo y
 * su resultado. El sondeo es el de siempre (`useBatchStatus`); aqui no hay reloj nuevo.
 */
export function DocumentBatchPanel({
  strategy,
  reviewHrefFor,
  disabled = false,
}: DocumentBatchPanelProps) {
  const titleId = useId();
  const remembered = useRememberedBatches(strategy);

  if (disabled || remembered.length === 0) return null;

  return (
    <section
      data-testid={DOCUMENT_BATCH_PANEL_TESTID}
      aria-labelledby={titleId}
      className="flex basis-full flex-col gap-2 text-left"
    >
      <h2 id={titleId} className="text-sm font-semibold">
        {PANEL_TITLE}
      </h2>
      <ul className="flex flex-col gap-2">
        {remembered.map((batch, index) => (
          <PanelBatch key={batch.batchId} remembered={batch} index={index} reviewHrefFor={reviewHrefFor} />
        ))}
      </ul>
    </section>
  );
}