'use client';

import { ArrowRightIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Spinner } from '@/components/shared/spinner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ErrorState } from '@/lib/modules/errores';
import {
  buildInventoryImportErrorFile,
  type ImportAlreadyDone,
  type ImportFileRejection as Rejection,
  type ImportNothingImported,
  type InventoryImportConfirmOutcome,
  type InventoryImportPreview,
  type InventoryImportResult,
} from '@/lib/modules/inventario';
import {
  confirmInventoryImportAction,
  previewInventoryImportAction,
} from '@/lib/modules/inventario/adapters/driving/inventory-import-actions';
import type { UnitView } from '@/lib/modules/unidades';

import { downloadFile } from './download-file';
import { ImportFileRejection, describeRejection } from './import-file-rejection';
import { ImportMissingCatalog } from './import-missing-catalog';
import { ImportPreviewSummary, STACKED_ACTIONS_CLASS } from './import-preview-summary';
import { ImportPreviewTable } from './import-preview-table';
import {
  ImportAlreadyDoneNotice,
  ImportNothingImportedSummary,
  ImportResultSummary,
} from './import-result-summary';
import { ImportSteps, importStepOf } from './import-steps';
import {
  IMPORT_SCREEN_TESTID,
  NOTHING_IMPORTED_TITLE,
  REJECTION_TITLE,
  REVIEWING_NOTICE,
  REVIEWING_TESTID,
  REVIEW_BUTTON_LABEL,
  REVIEW_BUTTON_TESTID,
  SCREEN_ERROR_TESTID,
  alreadyImportedMessage,
  importedToastMessage,
} from './import-texts';
import { ImportUploadField, exceedsImportMaxBytes } from './import-upload-field';

type Outcome =
  | { readonly kind: 'rejected'; readonly rejection: Rejection }
  | { readonly kind: 'preview'; readonly preview: InventoryImportPreview; readonly importKey: string }
  | { readonly kind: 'imported'; readonly result: InventoryImportResult }
  | { readonly kind: 'nothing_imported'; readonly nothing: ImportNothingImported }
  | { readonly kind: 'already_imported'; readonly done: ImportAlreadyDone };

function confirmOutcome(data: InventoryImportConfirmOutcome): Outcome {
  switch (data.kind) {
    case 'imported':
      return { kind: 'imported', result: data };
    case 'nothing_imported':
      return { kind: 'nothing_imported', nothing: data };
    case 'already_imported':
      return { kind: 'already_imported', done: data };
    case 'file_rejected':
      return { kind: 'rejected', rejection: data.rejection };
  }
}

type Busy = 'preview' | 'confirm' | null;

const STEP_ENTER_CLASS =
  'flex min-w-0 flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-(--dur-slow) motion-safe:ease-(--ease-enter)';

/** Aviso flotante del desenlace; el detalle sigue en pantalla. La vista previa no avisa. */
function notifyOutcome(outcome: Outcome) {
  switch (outcome.kind) {
    case 'imported':
      toast.success(importedToastMessage(outcome.result.totals));
      return;
    case 'nothing_imported':
      toast.error(NOTHING_IMPORTED_TITLE);
      return;
    case 'already_imported':
      toast.info(alreadyImportedMessage(outcome.done.importedAt));
      return;
    case 'rejected':
      toast.error(REJECTION_TITLE, { description: describeRejection(outcome.rejection).message });
      return;
    case 'preview':
      return;
  }
}

function notifyError(error: ErrorState) {
  toast.error(error.message);
}

function ScreenError({ error }: { readonly error: ErrorState }) {
  return (
    <ErrorAlert
      error={error}
      className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
      testId={SCREEN_ERROR_TESTID}
      withDataCode
    />
  );
}

export type InventoryImportScreenProps = {
  readonly units: readonly UnitView[];
};

export function InventoryImportScreen({ units }: InventoryImportScreenProps) {
  const [file, setFile] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  // Los diálogos de alta avisan después de un `await`: el archivo se lee de aquí para no depender
  // del render en el que se abrieron.
  const fileRef = useRef<File | null>(null);

  function selectFile(next: File) {
    fileRef.current = next;
    setFile(next);
    setOutcome(null);
    setError(null);
  }

  function restart() {
    fileRef.current = null;
    setFile(null);
    setOutcome(null);
    setError(null);
  }

  async function requestPreview() {
    const current = fileRef.current;
    if (current === null || exceedsImportMaxBytes(current)) return;
    setBusy('preview');
    setError(null);
    const formData = new FormData();
    formData.set('file', current);
    try {
      const response = await previewInventoryImportAction(formData);
      if (response.status === 'error') {
        setError(response);
        notifyError(response);
        return;
      }
      const data = response.data;
      const next: Outcome =
        data.kind === 'file_rejected'
          ? { kind: 'rejected', rejection: data.rejection }
          : { kind: 'preview', preview: data, importKey: crypto.randomUUID() };
      setOutcome(next);
      notifyOutcome(next);
    } finally {
      setBusy(null);
    }
  }

  async function confirm(importKey: string) {
    const current = fileRef.current;
    if (current === null) return;
    setBusy('confirm');
    setError(null);
    const formData = new FormData();
    formData.set('file', current);
    formData.set('importKey', importKey);
    try {
      const response = await confirmInventoryImportAction(formData);
      if (response.status === 'error') {
        // La vista previa y su clave se conservan: reintentar no puede importar dos veces.
        setError(response);
        notifyError(response);
        return;
      }
      const next = confirmOutcome(response.data);
      setOutcome(next);
      notifyOutcome(next);
    } finally {
      setBusy(null);
    }
  }

  const step = importStepOf(outcome);
  const canReview =
    file !== null && !exceedsImportMaxBytes(file) && busy === null && outcome?.kind !== 'preview';
  const reviewing = busy === 'preview';
  const screenError = error === null ? null : <ScreenError error={error} />;
  const reviewingNotice = reviewing ? (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={REVIEWING_TESTID}>
      <Spinner />
      {REVIEWING_NOTICE}
    </p>
  ) : null;

  return (
    <section
      className="flex min-w-0 flex-col gap-5"
      aria-busy={busy !== null}
      data-testid={IMPORT_SCREEN_TESTID}
    >
      <ImportSteps current={step} />

      <div key={step} className={STEP_ENTER_CLASS}>
        {step === 1 ? (
          <>
            <Card className="w-full max-w-[720px] gap-4 rounded-[14px] px-5 py-5">
              <ImportUploadField file={file} onSelect={selectFile} disabled={busy !== null} />
              <div className={STACKED_ACTIONS_CLASS}>
                <Button
                  type="button"
                  touch
                  disabled={!canReview}
                  aria-busy={reviewing}
                  data-testid={REVIEW_BUTTON_TESTID}
                  onClick={() => void requestPreview()}
                >
                  {reviewing ? <Spinner size="inherit" /> : null}
                  {REVIEW_BUTTON_LABEL}
                  {reviewing ? null : <ArrowRightIcon aria-hidden data-icon="inline-end" />}
                </Button>
              </div>
            </Card>
            {reviewingNotice}
            {screenError}
            {outcome?.kind === 'rejected' ? <ImportFileRejection rejection={outcome.rejection} /> : null}
          </>
        ) : null}

        {outcome?.kind === 'preview' ? (
          <ImportPreviewSummary
            preview={outcome.preview}
            confirming={busy === 'confirm'}
            onConfirm={() => void confirm(outcome.importKey)}
            onChooseAnother={restart}
            onDownloadErrors={() =>
              downloadFile(buildInventoryImportErrorFile(outcome.preview.rows, outcome.preview.fileName))
            }
          >
            <ImportMissingCatalog
              missingUnits={outcome.preview.missingUnits}
              missingPresentations={outcome.preview.missingPresentations}
              canCreateUnits={outcome.preview.canCreateUnits}
              canCreatePresentations={outcome.preview.canCreatePresentations}
              units={units}
              disabled={busy !== null}
              onCreated={() => void requestPreview()}
            />
            <ImportPreviewTable rows={outcome.preview.rows} />
            {reviewingNotice}
            {screenError}
          </ImportPreviewSummary>
        ) : null}

        {outcome?.kind === 'imported' ? (
          <ImportResultSummary
            result={outcome.result}
            onDownloadErrors={() =>
              downloadFile(buildInventoryImportErrorFile(outcome.result.rows, outcome.result.fileName))
            }
            onRestart={restart}
          />
        ) : null}

        {outcome?.kind === 'nothing_imported' ? (
          <ImportNothingImportedSummary
            nothing={outcome.nothing}
            onDownloadErrors={() =>
              downloadFile(buildInventoryImportErrorFile(outcome.nothing.rows, outcome.nothing.fileName))
            }
            onRestart={restart}
          />
        ) : null}

        {outcome?.kind === 'already_imported' ? (
          <ImportAlreadyDoneNotice done={outcome.done} onRestart={restart} />
        ) : null}
      </div>
    </section>
  );
}
