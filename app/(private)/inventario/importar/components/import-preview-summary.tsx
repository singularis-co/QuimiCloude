'use client';

import { DownloadIcon, InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Spinner } from '@/components/shared/spinner';
import type { StatusTone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { InventoryImportPreview } from '@/lib/modules/inventario';
import { cn } from '@/lib/utils';

import {
  CHOOSE_ANOTHER_TESTID,
  CONFIRMING_LABEL,
  CONFIRM_BUTTON_TESTID,
  ERROR_FILE_BUTTON_LABEL,
  ERROR_FILE_BUTTON_TESTID,
  EXAMPLE_ROW_IGNORED_NOTICE,
  EXAMPLE_ROW_NOTICE_TESTID,
  IGNORED_COLUMNS_SUMMARY_TESTID,
  IMPORT_FILE_NAME_TESTID,
  NO_VALID_ROWS_NOTICE,
  NO_VALID_ROWS_TESTID,
  PARTIAL_IMPORT_NOTICE,
  PREVIEW_ACTIONS_TESTID,
  PREVIEW_CARD_TESTID,
  PREVIEW_DESCRIPTION,
  PREVIEW_SUMMARY_TESTID,
  PREVIEW_TITLE,
  PREVIEW_TOTAL_LABELS,
  UPLOAD_CHANGE_LABEL,
  confirmLabelParts,
  formatCount,
  ignoredColumnsSummary,
  totalTestId,
} from './import-texts';

const TONE_TEXT_CLASS: Readonly<Partial<Record<StatusTone, string>>> = {
  success: 'text-success-text',
  info: 'text-info-text',
  waiting: 'text-warning-text',
  danger: 'text-destructive-text',
};

export const PREVIEW_TOTAL_TONES = {
  create: 'success',
  addBatch: 'info',
  duplicate: 'waiting',
  error: 'danger',
} as const satisfies Partial<Record<keyof typeof PREVIEW_TOTAL_LABELS, StatusTone>>;

export function ImportTotals<TKey extends string>({
  totals,
  labels,
  tones,
}: {
  readonly totals: Readonly<Record<TKey, number>>;
  readonly labels: Readonly<Record<TKey, string>>;
  readonly tones?: Readonly<Partial<Record<TKey, StatusTone>>>;
}) {
  const keys = Object.keys(labels) as TKey[];
  return (
    <dl className="m-0 grid w-full grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3 text-left">
      {keys.map((key) => {
        const tone = tones?.[key];
        return (
          <div
            key={key}
            className="flex flex-col gap-1.5 rounded-xl border bg-card px-4.5 py-4"
            data-testid={totalTestId(key)}
          >
            <dt className="text-xs font-semibold text-muted-foreground">{labels[key]}</dt>
            <dd
              className={cn(
                'm-0 font-mono text-[22px] font-semibold tabular-nums',
                tone === undefined ? undefined : TONE_TEXT_CLASS[tone],
              )}
              data-tone={tone}
            >
              {formatCount(totals[key])}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const NOTICE_CLASS = 'flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm';

export function ExampleRowIgnoredNotice() {
  return (
    <p role="status" className={NOTICE_CLASS} data-testid={EXAMPLE_ROW_NOTICE_TESTID}>
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {EXAMPLE_ROW_IGNORED_NOTICE}
    </p>
  );
}

export function ErrorFileButton({ onDownload }: { readonly onDownload: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      touch
      data-testid={ERROR_FILE_BUTTON_TESTID}
      onClick={onDownload}
    >
      <DownloadIcon aria-hidden />
      {ERROR_FILE_BUTTON_LABEL}
    </Button>
  );
}

/** Con 760 px de contenedor o menos, los botones se apilan a todo el ancho. */
export const STACKED_ACTIONS_CLASS =
  'flex flex-wrap justify-end gap-3 @max-[760px]:flex-col @max-[760px]:items-stretch';

export type ImportPreviewSummaryProps = {
  readonly preview: InventoryImportPreview;
  readonly confirming: boolean;
  readonly onConfirm: () => void;
  readonly onDownloadErrors: () => void;
  /** «Elegir otro archivo»: vuelve al paso 1 sin importar nada. */
  readonly onChooseAnother: () => void;
  /** Lo que va entre los avisos y los botones: los faltantes y la tabla de filas. */
  readonly children?: ReactNode;
};

export function ImportPreviewSummary({
  preview,
  confirming,
  onConfirm,
  onDownloadErrors,
  onChooseAnother,
  children,
}: ImportPreviewSummaryProps) {
  const { totals } = preview;
  const validRows = totals.create + totals.addBatch;
  const rowsWithIgnoredColumns = preview.rows.filter((row) => row.ignoredColumns !== undefined).length;
  const hasSkippedRows =
    totals.error + totals.duplicate > 0 ||
    preview.missingUnits.length + preview.missingPresentations.length > 0;
  const label = confirmLabelParts(validRows);

  return (
    <section className="flex min-w-0 flex-col gap-5" data-testid={PREVIEW_SUMMARY_TESTID}>
      <Card className="gap-4 rounded-[14px] px-5 py-5" data-testid={PREVIEW_CARD_TESTID}>
        <div className="flex items-start justify-between gap-3 @max-[760px]:flex-col @max-[760px]:items-stretch">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg font-semibold">{PREVIEW_TITLE}</h2>
            <span className="font-mono text-xs text-muted-foreground" data-testid={IMPORT_FILE_NAME_TESTID}>
              {preview.fileName}
            </span>
            <p className="text-sm text-muted-foreground">{PREVIEW_DESCRIPTION}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            touch
            disabled={confirming}
            data-testid={CHOOSE_ANOTHER_TESTID}
            onClick={onChooseAnother}
          >
            {UPLOAD_CHANGE_LABEL}
          </Button>
        </div>
        <ImportTotals totals={totals} labels={PREVIEW_TOTAL_LABELS} tones={PREVIEW_TOTAL_TONES} />
      </Card>
      {preview.exampleRowIgnored ? <ExampleRowIgnoredNotice /> : null}
      {rowsWithIgnoredColumns === 0 ? null : (
        <p role="status" className={NOTICE_CLASS} data-testid={IGNORED_COLUMNS_SUMMARY_TESTID}>
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {ignoredColumnsSummary(rowsWithIgnoredColumns)}
        </p>
      )}
      {validRows === 0 ? (
        <p role="status" className="text-sm text-muted-foreground" data-testid={NO_VALID_ROWS_TESTID}>
          {NO_VALID_ROWS_NOTICE}
        </p>
      ) : hasSkippedRows ? (
        <p className="text-sm text-muted-foreground">{PARTIAL_IMPORT_NOTICE}</p>
      ) : null}
      {children}
      <div className={STACKED_ACTIONS_CLASS} data-testid={PREVIEW_ACTIONS_TESTID}>
        {totals.error > 0 ? <ErrorFileButton onDownload={onDownloadErrors} /> : null}
        <Button
          type="button"
          touch
          disabled={validRows === 0 || confirming}
          aria-busy={confirming}
          data-testid={CONFIRM_BUTTON_TESTID}
          onClick={onConfirm}
        >
          {confirming ? <Spinner size="inherit" /> : null}
          {confirming ? (
            CONFIRMING_LABEL
          ) : (
            <>
              {label.before} <span className="font-mono tabular-nums">{label.count}</span> {label.after}
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
