'use client';

import { FileIcon } from 'lucide-react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { StatusBadge } from '@/components/shared/status-badge';
import type { DocumentFileStatusEntry } from '@/lib/modules/documentos';

import {
  BROWSER_PHASE_LABELS,
  BROWSER_PHASE_TONES,
  FILE_STATUS_LABELS,
  FILE_STATUS_TONES,
  REVIEW_LABEL,
  fileErrorMessage,
  type BrowserPhase,
} from './labels';

export const rowTestId = (index: number): string => `document-upload-row-${index}`;
export const rowNameTestId = (index: number): string => `document-upload-row-name-${index}`;
export const rowPhaseTestId = (index: number): string => `document-upload-row-phase-${index}`;
export const rowStatusTestId = (index: number): string => `document-upload-row-status-${index}`;
export const rowErrorTestId = (index: number): string => `document-upload-row-error-${index}`;
export const rowReasonTestId = (index: number): string => `document-upload-row-reason-${index}`;
export const rowReviewLinkTestId = (index: number): string => `document-upload-row-review-${index}`;

export type DocumentUploadRowProps = {
  readonly index: number;
  readonly fileName: string;
  readonly phase: BrowserPhase;
  /** Nulo mientras la tanda no existe: hasta entonces la fila solo puede pintar su fase. */
  readonly entry: DocumentFileStatusEntry | null;
  /**
   * Ausente por defecto: sin ella la fila no ofrece ningun acceso a revision, tal como se
   * comportaba antes de que existiera esta prop.
   */
  readonly reviewHrefFor?: (documentFileId: string) => string;
};

export function DocumentUploadRow({
  index,
  fileName,
  phase,
  entry,
  reviewHrefFor,
}: DocumentUploadRowProps) {
  const reviewHref =
    entry !== null && entry.status === 'done' && reviewHrefFor !== undefined
      ? reviewHrefFor(entry.id)
      : null;

  return (
    <li
      data-testid={rowTestId(index)}
      className="flex min-h-12 flex-wrap items-center gap-3 border-b py-2.5 text-base last:border-b-0"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-[40px] shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground"
      >
        <FileIcon className="size-5" />
      </span>

      <span data-testid={rowNameTestId(index)} className="min-w-0 grow basis-40 break-all">
        {fileName}
      </span>

      {entry === null ? (
        <StatusBadge
          tone={BROWSER_PHASE_TONES[phase]}
          label={BROWSER_PHASE_LABELS[phase]}
          data-testid={rowPhaseTestId(index)}
          data-phase={phase}
        />
      ) : (
        <StatusBadge
          tone={FILE_STATUS_TONES[entry.status]}
          label={FILE_STATUS_LABELS[entry.status]}
          data-testid={rowStatusTestId(index)}
          data-status={entry.status}
        />
      )}

      {reviewHref !== null ? (
        <ArrowLink
          href={reviewHref}
          direction="forward"
          size="sm"
          touch
          testId={rowReviewLinkTestId(index)}
        >
          {REVIEW_LABEL}
        </ArrowLink>
      ) : null}

      {entry !== null && entry.status === 'error' ? (
        <p data-testid={rowErrorTestId(index)} className="basis-full text-sm text-destructive">
          {fileErrorMessage(entry.errorCode)}
        </p>
      ) : null}

      {entry !== null && entry.status === 'error' && entry.errorReason !== null ? (
        <p data-testid={rowReasonTestId(index)} className="basis-full text-sm text-muted-foreground">
          {entry.errorReason}
        </p>
      ) : null}
    </li>
  );
}
