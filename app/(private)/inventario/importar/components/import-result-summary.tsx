'use client';

import { CircleAlertIcon, CircleCheckIcon, InfoIcon, UploadIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { StatusTone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type {
  ImportAlreadyDone,
  ImportNothingImported,
  ImportResultRow,
  ImportResultTotals,
  InventoryImportResult,
} from '@/lib/modules/inventario';
import { cn } from '@/lib/utils';

import {
  ErrorFileButton,
  ExampleRowIgnoredNotice,
  ImportTotals,
  STACKED_ACTIONS_CLASS,
} from './import-preview-summary';
import { ImportIssueList, ImportRowsTable, ImportStatusLabel } from './import-preview-table';
import {
  ALREADY_IMPORTED_TESTID,
  IMPORT_FILE_NAME_TESTID,
  NOTHING_IMPORTED_MESSAGE_TESTID,
  NOTHING_IMPORTED_TESTID,
  NOTHING_IMPORTED_TITLE,
  RESTART_LABEL,
  RESTART_TESTID,
  RESULT_CARD_TESTID,
  RESULT_STATUS_LABELS,
  RESULT_TABLE_TESTID,
  RESULT_TESTID,
  RESULT_TITLE,
  RESULT_TOTAL_LABELS,
  addedLotDetail,
  alreadyImportedMessage,
  createdLotDetail,
  duplicateLotDetail,
  nothingImportedMessage,
  resultDescription,
} from './import-texts';

type ResultStatus = ImportResultRow['status'];

export const RESULT_STATUS_TONES: Readonly<Record<ResultStatus, StatusTone>> = {
  created: 'success',
  batch_added: 'info',
  duplicate: 'waiting',
  error: 'danger',
};

const RESULT_TOTAL_TONES = {
  created: 'success',
  batchAdded: 'info',
  duplicate: 'waiting',
  error: 'danger',
} as const satisfies Partial<Record<keyof ImportResultTotals, StatusTone>>;

const RESULT_STATUS_ORDER: readonly ResultStatus[] = ['created', 'batch_added', 'duplicate', 'error'];

export const RESULT_TABLE_ID = 'inventario-importar-resultado';

function resultStatus(row: ImportResultRow): ReactNode {
  return (
    <ImportStatusLabel
      status={row.status}
      presentation={{ label: RESULT_STATUS_LABELS[row.status], tone: RESULT_STATUS_TONES[row.status] }}
    />
  );
}

function resultDetail(row: ImportResultRow): ReactNode {
  switch (row.status) {
    case 'created':
      return createdLotDetail(row.lot);
    case 'batch_added':
      return addedLotDetail(row.lot);
    case 'duplicate':
      return duplicateLotDetail(row.lot);
    case 'error':
      return <ImportIssueList issues={row.issues} />;
  }
}

function RestartButton({ onRestart }: { readonly onRestart: () => void }) {
  return (
    <Button type="button" touch data-testid={RESTART_TESTID} onClick={onRestart}>
      <UploadIcon aria-hidden />
      {RESTART_LABEL}
    </Button>
  );
}

const OUTCOME_ICON_CLASS: Readonly<Record<'success' | 'danger' | 'info', string>> = {
  success: 'bg-success-subtle text-success-text',
  danger: 'bg-destructive-subtle text-destructive-text',
  info: 'bg-info-subtle text-info-text',
};

/** Cabecera centrada del paso 3: icono, título, archivo y lo que pasó. */
function OutcomeCard({
  icon: Icon,
  tone,
  title,
  fileName,
  children,
}: {
  readonly icon: LucideIcon;
  readonly tone: keyof typeof OUTCOME_ICON_CLASS;
  readonly title?: string;
  readonly fileName?: string;
  readonly children: ReactNode;
}) {
  return (
    <Card
      className="mx-auto w-full max-w-[720px] items-center gap-4 rounded-[14px] px-6 py-10 text-center"
      data-testid={RESULT_CARD_TESTID}
    >
      <span
        className={cn('flex size-14 flex-none items-center justify-center rounded-2xl', OUTCOME_ICON_CLASS[tone])}
      >
        <Icon className="size-7" aria-hidden />
      </span>
      {title === undefined ? null : <h2 className="text-[22px] font-semibold">{title}</h2>}
      {fileName === undefined ? null : (
        <span className="font-mono text-xs text-muted-foreground" data-testid={IMPORT_FILE_NAME_TESTID}>
          {fileName}
        </span>
      )}
      {children}
    </Card>
  );
}

function OutcomeActions({
  hasErrors,
  onDownloadErrors,
  onRestart,
}: {
  readonly hasErrors: boolean;
  readonly onDownloadErrors?: () => void;
  readonly onRestart: () => void;
}) {
  return (
    <div className={cn(STACKED_ACTIONS_CLASS, 'w-full justify-center')}>
      {hasErrors && onDownloadErrors !== undefined ? <ErrorFileButton onDownload={onDownloadErrors} /> : null}
      <RestartButton onRestart={onRestart} />
    </div>
  );
}

function ResultTable({ rows }: { readonly rows: readonly ImportResultRow[] }) {
  const statuses = RESULT_STATUS_ORDER.map((value) => ({
    value,
    count: rows.reduce((total, row) => (row.status === value ? total + 1 : total), 0),
  }));

  return (
    <ImportRowsTable
      tableId={RESULT_TABLE_ID}
      testId={RESULT_TABLE_TESTID}
      rows={rows}
      statuses={statuses}
      statusLabels={RESULT_STATUS_LABELS}
      renderStatus={resultStatus}
      renderDetail={resultDetail}
    />
  );
}

function ResultFigures({
  totals,
  exampleRowIgnored,
}: {
  readonly totals: ImportResultTotals;
  readonly exampleRowIgnored: boolean;
}) {
  return (
    <>
      <ImportTotals totals={totals} labels={RESULT_TOTAL_LABELS} tones={RESULT_TOTAL_TONES} />
      {exampleRowIgnored ? <ExampleRowIgnoredNotice /> : null}
    </>
  );
}

export type ImportResultSummaryProps = {
  readonly result: InventoryImportResult;
  readonly onDownloadErrors: () => void;
  readonly onRestart: () => void;
};

export function ImportResultSummary({ result, onDownloadErrors, onRestart }: ImportResultSummaryProps) {
  return (
    <section className="flex min-w-0 flex-col gap-5" data-testid={RESULT_TESTID}>
      <OutcomeCard icon={CircleCheckIcon} tone="success" title={RESULT_TITLE} fileName={result.fileName}>
        <p className="text-sm text-muted-foreground">{resultDescription(result.fileName, result.importedAt)}</p>
        <ResultFigures totals={result.totals} exampleRowIgnored={result.exampleRowIgnored} />
        <OutcomeActions
          hasErrors={result.totals.error > 0}
          onDownloadErrors={onDownloadErrors}
          onRestart={onRestart}
        />
      </OutcomeCard>
      <ResultTable rows={result.rows} />
    </section>
  );
}

export type ImportNothingImportedSummaryProps = {
  readonly nothing: ImportNothingImported;
  readonly onDownloadErrors: () => void;
  readonly onRestart: () => void;
};

export function ImportNothingImportedSummary({
  nothing,
  onDownloadErrors,
  onRestart,
}: ImportNothingImportedSummaryProps) {
  return (
    <section className="flex min-w-0 flex-col gap-5" data-testid={NOTHING_IMPORTED_TESTID}>
      <OutcomeCard icon={CircleAlertIcon} tone="danger" title={NOTHING_IMPORTED_TITLE} fileName={nothing.fileName}>
        <p role="status" className="text-sm text-muted-foreground" data-testid={NOTHING_IMPORTED_MESSAGE_TESTID}>
          {nothingImportedMessage(nothing.fileName)}
        </p>
        <ResultFigures totals={nothing.totals} exampleRowIgnored={nothing.exampleRowIgnored} />
        <OutcomeActions
          hasErrors={nothing.totals.error > 0}
          onDownloadErrors={onDownloadErrors}
          onRestart={onRestart}
        />
      </OutcomeCard>
      <ResultTable rows={nothing.rows} />
    </section>
  );
}

export function ImportAlreadyDoneNotice({
  done,
  onRestart,
}: {
  readonly done: ImportAlreadyDone;
  readonly onRestart: () => void;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-5" data-testid={ALREADY_IMPORTED_TESTID}>
      <OutcomeCard icon={InfoIcon} tone="info">
        <p role="status" className="text-sm">
          {alreadyImportedMessage(done.importedAt)}
        </p>
        <OutcomeActions hasErrors={false} onRestart={onRestart} />
      </OutcomeCard>
    </section>
  );
}
