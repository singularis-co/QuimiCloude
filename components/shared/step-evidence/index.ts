/**
 * Barrel de `components/shared/step-evidence`. Sin `'use client'` aquí: la frontera
 * cliente/servidor la declara cada componente.
 */

export {
  MAX_STEP_EVIDENCE_PHOTOS,
  STEP_EVIDENCE_TEXTS,
  StepEvidence,
  type StepEvidenceProps,
  type StepEvidenceTile,
} from './step-evidence';

export { EvidenceReadError, type EvidenceReadErrorProps } from './evidence-read-error';

export { EvidenceStepList, type EvidenceStepListProps } from './evidence-step-list';

export {
  EVIDENCE_MISSING_TEXTS,
  EvidenceMissingDialog,
  type EvidenceMissingDialogProps,
} from './evidence-missing-dialog';

export {
  EVIDENCE_ACCEPTED_TYPES,
  EVIDENCE_MAX_DIMENSION,
  UPLOAD_EVIDENCE_TEXTS,
  uploadEvidence,
  type EvidenceUploadTarget,
  type RegisterEvidence,
  type RequestEvidenceUpload,
  type UploadEvidenceOptions,
  type UploadEvidenceResult,
  type UploadEvidenceStage,
} from './upload-evidence';
