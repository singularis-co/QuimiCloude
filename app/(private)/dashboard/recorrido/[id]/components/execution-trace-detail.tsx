import type { ReactNode } from 'react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  ActiveOrderMark,
  DeletedOrderMark,
  TRACE_ORDER_STATUS_LABELS,
  formatTraceDuration,
} from '@/app/(private)/dashboard/components';
import type { ExecutionTraceDetail as ExecutionTraceDetailData } from '@/lib/modules/asignaciones';
import type { ErrorState as OperationError } from '@/lib/modules/errores';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import { ExecutionTimeline } from './execution-timeline';

export const BACK_TO_LIST_TEXT = 'Volver a la lista';
export { EMPTY_MARK as MISSING_PERSON_MARK } from '@/lib/shared/ui/empty-mark';

const TITLE_PREFIX = 'Recorrido del pedido';
const ERROR_TITLE = 'Recorrido';
const ERROR_MESSAGE = 'No se pudo cargar el recorrido.';
const STAT_LABELS = {
  status: 'Estado',
  duration: 'Duración',
  goBacks: 'Vueltas atrás',
} as const;

function BackToList({ href }: { readonly href: string }) {
  return (
    <ArrowLink direction="back" touch href={href} testId="execution-trace-back" className="self-start">
      {BACK_TO_LIST_TEXT}
    </ArrowLink>
  );
}

function Stat({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div
      data-testid="execution-trace-stat"
      className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card px-[18px] py-4"
    >
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-[22px] font-semibold">{children}</dd>
    </div>
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
  readonly backHref: string;
};

export function ExecutionTraceDetail({ trace, backHref }: ExecutionTraceDetailProps) {
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
        <dl className="m-0 grid grid-cols-3 gap-3 @max-[760px]:grid-cols-1">
          <Stat label={STAT_LABELS.status}>
            <StatusBadge
              tone={ORDER_STATUS_TONES[trace.status]}
              label={TRACE_ORDER_STATUS_LABELS[trace.status]}
              data-testid="execution-trace-status"
              data-status={trace.status}
            />
            {trace.deleted ? <DeletedOrderMark /> : null}
            {!trace.deleted && trace.duration.kind === 'open' ? <ActiveOrderMark /> : null}
          </Stat>
          <Stat label={STAT_LABELS.duration}>
            <span className="font-mono" data-testid="execution-trace-duration" data-kind={trace.duration.kind}>
              {formatTraceDuration(trace.duration)}
            </span>
          </Stat>
          <Stat label={STAT_LABELS.goBacks}>
            <GoBackCount count={trace.goBackCount} />
          </Stat>
        </dl>
        <ExecutionTimeline steps={trace.steps} />
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
