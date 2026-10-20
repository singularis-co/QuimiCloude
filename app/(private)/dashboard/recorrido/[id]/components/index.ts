// Barrel de los componentes de la ruta del recorrido. Sin frontera cliente/servidor aqui.
export {
  BACK_TO_LIST_TEXT,
  ExecutionTraceDetail,
  ExecutionTraceDetailError,
  MISSING_PERSON_MARK,
  type ExecutionTraceDetailProps,
} from './execution-trace-detail';
export { ExecutionTimeline, type ExecutionTimelineProps } from './execution-timeline';
export {
  ConditioningBatchLinesTable,
  ConditioningBatchSaveBody,
  ConditioningStartBody,
  type ConditioningBatchLinesTableProps,
  type ConditioningBatchSaveBodyProps,
  type ConditioningStartBodyProps,
} from './conditioning-step-details';
export {
  placeManufacturingEvidence,
  type TraceEvidencePlacement,
} from './trace-evidence-placement';
export {
  OTHER_STEPS_EVIDENCE_TEXTS,
  TraceEvidenceReadError,
  TraceOtherStepsEvidence,
  type TraceOtherStepsEvidenceProps,
} from './trace-other-steps-evidence';
export { PACKING_EVIDENCE_TEXTS, TracePackingEvidence, type TracePackingEvidenceProps } from './trace-packing-evidence';
export {
  MANUFACTURING_PHASE_LABEL,
  TraceStepEvidence,
  type TraceStepEvidenceProps,
} from './trace-step-evidence';
