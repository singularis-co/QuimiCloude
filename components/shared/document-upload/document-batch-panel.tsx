'use client';

import { ChevronRightIcon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { PdfStrategy } from '@/lib/modules/documentos';
import { cn } from '@/lib/utils';

import { forgetBatch, type RememberedBatch } from './batch-memory';
import {
  batchStatusSnapshot,
  listenBatchStatus,
  type BatchStatusSnapshot,
} from './batch-status-store';
import { DocumentUploadRow } from './document-upload-row';
import {
  DISCARD_BATCH_LABEL,
  PANEL_TITLE,
  READ_ONLY_NOTICE,
  RESUME_LABEL,
  UNKNOWN_BATCH_LABEL,
  batchLabel,
  batchesSummary,
  discardBatchLabel,
  resumeBatchLabel,
} from './labels';
import { useBatchStatus } from './use-batch-status';
import { useRememberedBatches } from './use-remembered-batches';

export const DOCUMENT_BATCH_PANEL_TESTID = 'document-upload-panel';

/** El `scope` de las filas del panel: no comparten `data-testid` con las de la ventana. */
export const PANEL_ROW_SCOPE = 'document-upload-panel';

export const PANEL_READ_ONLY_NOTICE_TESTID = 'document-upload-panel-read-only';
export const PANEL_COUNT_TESTID = 'document-upload-panel-count';
export const PANEL_SUMMARY_TESTID = 'document-upload-panel-summary';

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
  /** `<userId>:<companyId>`: el panel solo ve las tandas de ese ámbito. */
  readonly registryScope: string;
  /** Opcional: se pasa tal cual a cada fila. */
  readonly reviewHrefFor?: (documentFileId: string) => string;
  /** Con la subida deshabilitada el panel sigue a la vista, en solo lectura y con un aviso. */
  readonly disabled?: boolean;
};

const NO_SNAPSHOTS: readonly BatchStatusSnapshot[] = [];

const serverSnapshots = (): readonly BatchStatusSnapshot[] => NO_SNAPSHOTS;

/**
 * La ultima foto de cada tanda. Se engancha al mismo bucle de sondeo que sus bloques, asi que no
 * lanza consultas propias.
 */
function useBatchSnapshots(batchIds: readonly string[]): readonly BatchStatusSnapshot[] {
  const last = useRef(NO_SNAPSHOTS);
  const listen = useCallback(
    (onChange: () => void) => {
      const stops = batchIds.map((batchId) => listenBatchStatus(batchId, onChange));
      return () => {
        for (const stop of stops) stop();
      };
    },
    [batchIds],
  );
  // useSyncExternalStore exige la misma referencia mientras ninguna foto cambie.
  const snapshot = useCallback(() => {
    const next = batchIds.map(batchStatusSnapshot);
    const previous = last.current;
    const same =
      next.length === previous.length && next.every((item, index) => item === previous[index]);
    if (same) return previous;
    last.current = next;
    return next;
  }, [batchIds]);
  return useSyncExternalStore(listen, snapshot, serverSnapshots);
}

type PanelBatchProps = {
  readonly registryScope: string;
  readonly remembered: RememberedBatch;
  readonly index: number;
  readonly reviewHrefFor?: (documentFileId: string) => string;
};

function PanelBatch({ registryScope, remembered, index, reviewHrefFor }: PanelBatchProps) {
  const labelId = useId();
  const { status, error, missing, resume } = useBatchStatus(remembered.batchId);
  // El servidor nunca pinta el panel: la hora local solo se calcula en el cliente.
  const [now] = useState(Date.now);
  const { rememberedAt } = remembered;

  return (
    <li
      data-testid={panelBatchTestId(index)}
      aria-labelledby={labelId}
      className="flex flex-col gap-2 border-t px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={labelId} className="min-w-0 text-base font-semibold">
          {batchLabel(rememberedAt, status === null ? null : status.files.length, now)}
        </h3>
        <Button
          type="button"
          variant="ghost"
          touch
          className="ml-auto text-base"
          aria-label={discardBatchLabel(rememberedAt, now)}
          data-testid={panelDiscardTestId(index)}
          onClick={() => forgetBatch(registryScope, remembered.batchId)}
        >
          {DISCARD_BATCH_LABEL}
        </Button>
      </div>

      {missing ? (
        <p
          data-testid={panelMissingTestId(index)}
          role="status"
          className="text-base text-muted-foreground"
        >
          {UNKNOWN_BATCH_LABEL}
        </p>
      ) : null}

      {error !== null ? (
        <div className="flex flex-wrap items-center gap-2">
          <p
            data-testid={panelErrorTestId(index)}
            role="alert"
            className="min-w-0 grow text-base text-destructive"
          >
            {error.message}
          </p>
          <Button
            type="button"
            variant="outline"
            touch
            className="text-base"
            aria-label={resumeBatchLabel(rememberedAt, now)}
            data-testid={panelResumeTestId(index)}
            onClick={resume}
          >
            {RESUME_LABEL}
          </Button>
        </div>
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
 * Las tandas recordadas, fuera de la ventana de subida. Plegado, la lista sigue montada: cada tanda
 * conserva su sondeo y su ultima foto.
 */
export function DocumentBatchPanel({
  strategy,
  registryScope,
  reviewHrefFor,
  disabled = false,
}: DocumentBatchPanelProps) {
  const titleId = useId();
  const remembered = useRememberedBatches(registryScope, strategy);
  const batchIds = useMemo(() => remembered.map(({ batchId }) => batchId), [remembered]);
  const snapshots = useBatchSnapshots(batchIds);

  if (remembered.length === 0) return null;

  return (
    <section
      data-testid={DOCUMENT_BATCH_PANEL_TESTID}
      aria-labelledby={titleId}
      className="w-full rounded-xl border bg-card text-left"
    >
      <Collapsible defaultOpen>
        <div className="flex flex-wrap items-center gap-2 py-1 pr-4 pl-2">
          <h2 className="flex items-center">
            <CollapsibleTrigger
              className={cn(
                buttonVariants({ variant: 'ghost', touch: true }),
                'group text-base font-semibold',
              )}
            >
              <ChevronRightIcon
                aria-hidden="true"
                className={cn(
                  'transition-transform duration-(--dur-base) motion-reduce:transition-none',
                  'group-data-[panel-open]:rotate-90',
                )}
              />
              <span id={titleId}>{PANEL_TITLE}</span>
            </CollapsibleTrigger>
          </h2>
          <Badge variant="neutral" data-testid={PANEL_COUNT_TESTID}>
            {remembered.length}
          </Badge>
          <p data-testid={PANEL_SUMMARY_TESTID} className="ml-auto text-base text-muted-foreground">
            {batchesSummary(snapshots)}
          </p>
        </div>
        <CollapsibleContent keepMounted>
          {disabled ? (
            <p
              data-testid={PANEL_READ_ONLY_NOTICE_TESTID}
              className="flex items-start gap-2 border-t px-4 py-3 text-base text-muted-foreground"
            >
              <TriangleAlertIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
              <span>{READ_ONLY_NOTICE}</span>
            </p>
          ) : null}
          <ul className="flex flex-col">
            {remembered.map((batch, index) => (
              <PanelBatch
                key={batch.batchId}
                registryScope={registryScope}
                remembered={batch}
                index={index}
                reviewHrefFor={reviewHrefFor}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
