import type { ReactNode } from 'react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  ActiveOrderMark,
  DeletedOrderMark,
  PHASE_DURATION_LABELS,
  PHASE_OPEN_MARK,
  PHASE_UNCLOSED_MARK,
  TRACE_ORDER_STATUS_LABELS,
  formatElapsed,
} from '@/app/(private)/dashboard/components';
import type {
  ExecutionPhase,
  ExecutionTraceDetail as ExecutionTraceDetailData,
  TraceDuration,
} from '@/lib/modules/asignaciones';
import type { ExecutionEvidenceResult } from '@/lib/modules/asignaciones/adapters/driving/execution-trace-actions';
import type { ErrorState as OperationError } from '@/lib/modules/errores';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import { ExecutionTimeline } from './execution-timeline';
import { TracePackingEvidence } from './trace-packing-evidence';

export const BACK_TO_LIST_TEXT = 'Volver a la lista';
export { EMPTY_MARK as MISSING_PERSON_MARK } from '@/lib/shared/ui/empty-mark';

const TITLE_PREFIX = 'Recorrido del pedido';
const ERROR_TITLE = 'Recorrido';
const ERROR_MESSAGE = 'No se pudo cargar el recorrido.';
const STAT_LABELS = {
  status: 'Estado',
  goBacks: 'Vueltas atrás',
} as const;
const PHASE_ORDER: readonly ExecutionPhase[] = ['production', 'packing', 'conditioning'];

function BackToList({ href }: { readonly href: string }) {
  return (
    <ArrowLink direction="back" touch href={href} testId="execution-trace-back" className="self-start">
      {BACK_TO_LIST_TEXT}
    </ArrowLink>
  );
}

type StatProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly phase?: ExecutionPhase;
  readonly kind?: TraceDuration['kind'];
};

function Stat({ label, children, testId = 'execution-trace-stat', phase, kind }: StatProps) {
  return (
    <div
      data-testid={testId}
      data-phase={phase}
      data-kind={kind}
      className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card px-[18px] py-4"
    >
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-[22px] font-semibold">{children}</dd>
    </div>
  );
}

function PhaseDuration({ phase, duration }: { readonly phase: ExecutionPhase; readonly duration: TraceDuration }) {
  return (
    <Stat label={PHASE_DURATION_LABELS[phase]} testId="execution-trace-duration" phase={phase} kind={duration.kind}>
      <span className="font-mono">{formatElapsed(duration.ms)}</span>
      {duration.kind === 'open' ? (
        <StatusBadge tone="progress" label={PHASE_OPEN_MARK} data-testid="execution-trace-phase-open" />
      ) : null}
      {duration.kind === 'unclosed' ? (
        <StatusBadge tone="muted" label={PHASE_UNCLOSED_MARK} data-testid="execution-trace-phase-unclosed" />
      ) : null}
    </Stat>
  );
}

function GoBackCount({ count }: { readonly count: number }) {
  if (count === 0) {
    return (
      <span data-testid="execution-trace-go-backs" className="font-mono text-muted-foreground tabular-nums">
        {count}
      </span>
    );
  }
  return <StatusBadge tone="waiting" label={String(count)} data-testid="execution-trace-go-backs" />;
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
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(170px,calc(50%_-_6px)),1fr))] gap-3">
          <Stat label={STAT_LABELS.status}>
            <StatusBadge
              tone={ORDER_STATUS_TONES[trace.status]}
              label={TRACE_ORDER_STATUS_LABELS[trace.status]}
              data-testid="execution-trace-status"
              data-status={trace.status}
            />
            {trace.deleted ? <DeletedOrderMark /> : null}
            {!trace.deleted && trace.active ? <ActiveOrderMark /> : null}
          </Stat>
          {PHASE_ORDER.map((phase) => {
            const duration = trace.durations[phase];
            return duration === null ? null : <PhaseDuration key={phase} phase={phase} duration={duration} />;
          })}
          <Stat label={STAT_LABELS.goBacks}>
            <GoBackCount count={trace.goBackCount} />
          </Stat>
        </dl>
        <ExecutionTimeline steps={trace.steps} evidence={evidence} />
        {evidence?.status === 'success' && evidence.data.packing.length > 0 ? (
          <TracePackingEvidence groups={evidence.data.packing} />
        ) : null}
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
