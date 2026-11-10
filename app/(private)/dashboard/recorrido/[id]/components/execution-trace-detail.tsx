import { ArrowLink } from '@/components/shared/arrow-link';
import { ErrorState } from '@/components/shared/error-state';
import { OrderProgress } from '@/components/shared/order-progress';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { StatusBadge } from '@/components/shared/status-badge';
import { DeletedOrderMark, TRACE_ORDER_STATUS_LABELS } from '@/app/(private)/dashboard/components';
import type {
  ExecutionTraceDetail as ExecutionTraceDetailData,
  OrderEvidence,
} from '@/lib/modules/asignaciones';
import type { ExecutionEvidenceResult } from '@/lib/modules/asignaciones/adapters/driving/execution-trace-actions';
import type { ErrorState as OperationError } from '@/lib/modules/errores';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import type { TraceEvidenceResult } from './execution-timeline';
import { ExecutionTraceRecipeSection } from './execution-trace-recipe-section';
import { DurationValue, STAT_GRID_CLASS, Stat } from './execution-trace-stat';

export const BACK_TO_LIST_TEXT = 'Volver a la lista';
export { EMPTY_MARK as MISSING_PERSON_MARK } from '@/lib/shared/ui/empty-mark';

const TITLE_PREFIX = 'Recorrido del pedido';
const ERROR_TITLE = 'Recorrido';
const ERROR_MESSAGE = 'No se pudo cargar el recorrido.';
export const TRACE_SUMMARY_LABELS = {
  status: 'Estado',
  progress: 'Avance',
  duration: 'Duración',
} as const;

const NO_EVIDENCE: OrderEvidence = { manufacturing: [], packing: [], conditioning: [] };

function BackToList({ href }: { readonly href: string }) {
  return (
    <ArrowLink direction="back" touch href={href} testId="execution-trace-back" className="self-start">
      {BACK_TO_LIST_TEXT}
    </ArrowLink>
  );
}

/** Las fotos llegan agrupadas por línea: cada sección se queda solo con las suyas. */
export function evidenceOfLine(
  evidence: ExecutionEvidenceResult | undefined,
  lineId: string,
): TraceEvidenceResult | undefined {
  if (evidence === undefined || evidence.status !== 'success') return evidence;
  const recipe = evidence.data.recipes.find((entry) => entry.lineId === lineId);
  return { status: 'success', data: recipe?.evidence ?? NO_EVIDENCE };
}

export type ExecutionTraceDetailProps = {
  readonly trace: ExecutionTraceDetailData;
  readonly evidence?: ExecutionEvidenceResult;
  readonly backHref: string;
};

export function ExecutionTraceDetail({ trace, evidence, backHref }: ExecutionTraceDetailProps) {
  return (
    <PageShell>
      <div data-testid="execution-trace-detail" className="contents">
        <BackToList href={backHref} />
        <PageHeader
          title={
            <>
              {TITLE_PREFIX} <span className="font-mono">{trace.numberText}</span>
            </>
          }
          titleTestId="execution-trace-title"
        />
        <dl className={STAT_GRID_CLASS} data-testid="execution-trace-summary">
          <Stat label={TRACE_SUMMARY_LABELS.status}>
            <StatusBadge
              tone={ORDER_STATUS_TONES[trace.status]}
              label={TRACE_ORDER_STATUS_LABELS[trace.status]}
              data-testid="execution-trace-status"
              data-status={trace.status}
            />
            {trace.deleted ? <DeletedOrderMark /> : null}
          </Stat>
          <Stat label={TRACE_SUMMARY_LABELS.progress} testId="execution-trace-progress">
            <OrderProgress progress={trace.progress} variant="long" className="text-base font-normal" />
          </Stat>
          <Stat label={TRACE_SUMMARY_LABELS.duration} testId="execution-trace-total-duration" kind={trace.totalDuration.kind}>
            <DurationValue duration={trace.totalDuration} markTestIdPrefix="execution-trace-total" />
          </Stat>
        </dl>
        {trace.recipes.map((recipe) => (
          <ExecutionTraceRecipeSection
            key={recipe.lineId}
            recipe={recipe}
            evidence={evidenceOfLine(evidence, recipe.lineId)}
          />
        ))}
      </div>
    </PageShell>
  );
}

export function ExecutionTraceDetailError({
  error,
  backHref,
}: {
  readonly error: OperationError;
  readonly backHref: string;
}) {
  return (
    <PageShell>
      <BackToList href={backHref} />
      <PageHeader title={ERROR_TITLE} />
      <ErrorState
        error={error}
        title={ERROR_MESSAGE}
        testId="execution-trace-detail-error"
        withCode={false}
        className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 p-4"
      />
    </PageShell>
  );
}
