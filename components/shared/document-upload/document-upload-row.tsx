'use client';

import { FileIcon } from 'lucide-react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { StatusBadge } from '@/components/shared/status-badge';
import type { DocumentFileStatusEntry } from '@/lib/modules/documentos';
import { cn } from '@/lib/utils';

import {
  BROWSER_PHASE_LABELS,
  BROWSER_PHASE_TONES,
  FILE_STATUS_LABELS,
  FILE_STATUS_TONES,
  REVIEW_LABEL,
  attemptLabel,
  fileErrorMessage,
  type BrowserPhase,
} from './labels';

export const DEFAULT_ROW_SCOPE = 'document-upload';

/**
 * El `scope` distingue las filas que se pintan en dos sitios a la vez (la ventana y el panel): sin
 * el, dos filas del mismo archivo compartiran `data-testid` y nadie podria senalar una sola.
 */
export const rowTestId = (index: number, scope = DEFAULT_ROW_SCOPE): string =>
  `${scope}-row-${index}`;
export const rowNameTestId = (index: number, scope = DEFAULT_ROW_SCOPE): string =>
  `${scope}-row-name-${index}`;
export const rowPhaseTestId = (index: number, scope = DEFAULT_ROW_SCOPE): string =>
  `${scope}-row-phase-${index}`;
export const rowStatusTestId = (index: number, scope = DEFAULT_ROW_SCOPE): string =>
  `${scope}-row-status-${index}`;
export const rowAttemptTestId = (index: number, scope = DEFAULT_ROW_SCOPE): string =>
  `${scope}-row-attempt-${index}`;
export const rowErrorTestId = (index: number, scope = DEFAULT_ROW_SCOPE): string =>
  `${scope}-row-error-${index}`;
export const rowReasonTestId = (index: number, scope = DEFAULT_ROW_SCOPE): string =>
  `${scope}-row-reason-${index}`;
export const rowReviewLinkTestId = (index: number, scope = DEFAULT_ROW_SCOPE): string =>
  `${scope}-row-review-${index}`;

export type DocumentUploadRowProps = {
  readonly index: number;
  readonly fileName: string;
  /** La fase del navegador; sin tanda en marcha no hay fase que pintar. */
  readonly phase?: BrowserPhase;
  /** Nulo mientras la tanda no existe: hasta entonces la fila solo puede pintar su fase. */
  readonly entry: DocumentFileStatusEntry | null;
  /** Con el tope de intentos, la fila anade «intento N de M». Ausente, la fila queda como era. */
  readonly maxAttempts?: number;
  readonly scope?: string;
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
  maxAttempts,
  scope = DEFAULT_ROW_SCOPE,
  reviewHrefFor,
}: DocumentUploadRowProps) {
  const reviewHref =
    entry !== null && entry.status === 'done' && reviewHrefFor !== undefined
      ? reviewHrefFor(entry.id)
      : null;

  return (
    <li
      data-testid={rowTestId(index, scope)}
      className={cn(
        'flex min-h-12 flex-wrap items-center gap-3',
        'border-b py-2.5 text-base last:border-b-0',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-[40px] shrink-0 items-center justify-center',
          'rounded-lg border bg-muted text-muted-foreground',
        )}
      >
        <FileIcon className="size-5" />
      </span>

      <span data-testid={rowNameTestId(index, scope)} className="min-w-0 grow basis-40 break-all">
        {fileName}
      </span>

      {entry !== null ? (
        <StatusBadge
          tone={FILE_STATUS_TONES[entry.status]}
          label={FILE_STATUS_LABELS[entry.status]}
          data-testid={rowStatusTestId(index, scope)}
          data-status={entry.status}
        />
      ) : phase !== undefined ? (
        <StatusBadge
          tone={BROWSER_PHASE_TONES[phase]}
          label={BROWSER_PHASE_LABELS[phase]}
          data-testid={rowPhaseTestId(index, scope)}
          data-phase={phase}
        />
      ) : null}

      {entry !== null && maxAttempts !== undefined ? (
        <span
          data-testid={rowAttemptTestId(index, scope)}
          className="shrink-0 text-sm whitespace-nowrap text-muted-foreground"
        >
          {attemptLabel(entry.attempts, maxAttempts)}
        </span>
      ) : null}

      {reviewHref !== null ? (
        <ArrowLink
          href={reviewHref}
          direction="forward"
          size="sm"
          touch
          testId={rowReviewLinkTestId(index, scope)}
        >
          {REVIEW_LABEL}
        </ArrowLink>
      ) : null}

      {entry !== null && entry.status === 'error' ? (
        <p
          data-testid={rowErrorTestId(index, scope)}
          className="basis-full text-sm text-destructive"
        >
          {fileErrorMessage(entry.errorCode)}
        </p>
      ) : null}

      {entry !== null && entry.status === 'error' && entry.errorReason !== null ? (
        <p
          data-testid={rowReasonTestId(index, scope)}
          className="basis-full text-sm text-muted-foreground"
        >
          {entry.errorReason}
        </p>
      ) : null}
    </li>
  );
}
