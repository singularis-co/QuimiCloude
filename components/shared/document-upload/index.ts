/**
 * Barrel de `components/shared/document-upload`: la unica superficie publica de la pieza.
 * Sin `'use client'` aqui — la frontera cliente/servidor la declara cada componente.
 */

export {
  DOCUMENT_BATCH_PANEL_TESTID,
  DocumentBatchPanel,
  PANEL_ROW_SCOPE,
  panelBatchTestId,
  panelDiscardTestId,
  panelErrorTestId,
  panelMissingTestId,
  panelResumeTestId,
  type DocumentBatchPanelProps,
} from './document-batch-panel';

export {
  DOCUMENT_UPLOAD_CLOSE_TESTID,
  DOCUMENT_UPLOAD_DIALOG_TESTID,
  DOCUMENT_UPLOAD_OPEN_TESTID,
  DocumentUploadDialog,
  type DocumentUploadDialogProps,
} from './document-upload-dialog';

export {
  DocumentUpload,
  DOCUMENT_UPLOAD_CLEAR_TESTID,
  DOCUMENT_UPLOAD_ERROR_TESTID,
  DOCUMENT_UPLOAD_INPUT_TESTID,
  DOCUMENT_UPLOAD_LIST_TESTID,
  DOCUMENT_UPLOAD_MISSING_TESTID,
  DOCUMENT_UPLOAD_RESUME_TESTID,
  DOCUMENT_UPLOAD_SELECTION_ERROR_TESTID,
  DOCUMENT_UPLOAD_SUBMIT_TESTID,
  DOCUMENT_UPLOAD_TESTID,
  DOCUMENT_UPLOAD_TRIGGER_TESTID,
  type DocumentUploadProps,
} from './document-upload';

export {
  DEFAULT_ROW_SCOPE,
  DocumentUploadRow,
  rowAttemptTestId,
  rowErrorTestId,
  rowNameTestId,
  rowPhaseTestId,
  rowReasonTestId,
  rowReviewLinkTestId,
  rowStatusTestId,
  rowTestId,
  type DocumentUploadRowProps,
} from './document-upload-row';

export {
  BROWSER_PHASE_LABELS,
  BROWSER_PHASE_TONES,
  CLOSE_LABEL,
  DIALOG_TITLE,
  DISCARD_BATCH_LABEL,
  FILE_STATUS_LABELS,
  FILE_STATUS_TONES,
  OPEN_LABEL,
  PANEL_BATCH_LABEL,
  PANEL_TITLE,
  REVIEW_LABEL,
  attemptLabel,
  dialogDescription,
  fileErrorMessage,
  tooManyFilesMessage,
  type BrowserPhase,
} from './labels';

export {
  MAX_REMEMBERED_BATCHES,
  REMEMBERED_BATCHES_STORAGE_KEY,
  forgetBatch,
  onRememberedBatchesChange,
  rememberBatch,
  rememberedBatches,
  type RememberedBatch,
} from './batch-memory';

export { useRememberedBatches } from './use-remembered-batches';
export { BATCH_STATUS_POLL_INTERVAL_MS, useBatchStatus } from './use-batch-status';
export { PDF_CONTENT_TYPE, uploadFile } from './upload-file';