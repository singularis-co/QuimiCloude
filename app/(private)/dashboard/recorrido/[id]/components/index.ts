// Barrel de los componentes de la ruta del recorrido. Sin frontera cliente/servidor aqui.
export {
  BACK_TO_LIST_TEXT,
  ExecutionTraceDetail,
  ExecutionTraceDetailError,
  MISSING_PERSON_MARK,
  TRACE_SUMMARY_LABELS,
  evidenceOfLine,
  type ExecutionTraceDetailProps,
} from './execution-trace-detail';
export {
  EXECUTION_TRACE_RECIPE_SECTION_TESTID,
  ExecutionTraceRecipeSection,
  RECIPE_SECTION_TEXTS,
  type ExecutionTraceRecipeSectionProps,
} from './execution-trace-recipe-section';
export { DurationValue, PhaseDuration, STAT_GRID_CLASS, Stat } from './execution-trace-stat';
export {
  ExecutionTimeline,
  type ExecutionTimelineProps,
  type TraceEvidenceResult,
} from './execution-timeline';
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
