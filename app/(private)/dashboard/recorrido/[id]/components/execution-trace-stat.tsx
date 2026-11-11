import type { ReactNode } from 'react';

import { StatusBadge } from '@/components/shared/status-badge';
import {
  PHASE_DURATION_LABELS,
  PHASE_OPEN_MARK,
  PHASE_UNCLOSED_MARK,
  formatElapsed,
} from '@/app/(private)/dashboard/components';
import type { ExecutionPhase, TraceDuration } from '@/lib/modules/asignaciones';

export const STAT_GRID_CLASS = 'm-0 grid grid-cols-[repeat(auto-fit,minmax(min(170px,calc(50%_-_6px)),1fr))] gap-3';

type StatProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly phase?: ExecutionPhase;
  readonly kind?: TraceDuration['kind'];
};

export function Stat({ label, children, testId = 'execution-trace-stat', phase, kind }: StatProps) {
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

export function DurationValue({
  duration,
  markTestIdPrefix = 'execution-trace-phase',
}: {
  readonly duration: TraceDuration;
  readonly markTestIdPrefix?: string;
}) {
  return (
    <>
      <span className="font-mono">{formatElapsed(duration.ms)}</span>
      {duration.kind === 'open' ? (
        <StatusBadge tone="progress" label={PHASE_OPEN_MARK} data-testid={`${markTestIdPrefix}-open`} />
      ) : null}
      {duration.kind === 'unclosed' ? (
        <StatusBadge tone="muted" label={PHASE_UNCLOSED_MARK} data-testid={`${markTestIdPrefix}-unclosed`} />
      ) : null}
    </>
  );
}

export function PhaseDuration({ phase, duration }: { readonly phase: ExecutionPhase; readonly duration: TraceDuration }) {
  return (
    <Stat label={PHASE_DURATION_LABELS[phase]} testId="execution-trace-duration" phase={phase} kind={duration.kind}>
      <DurationValue duration={duration} />
    </Stat>
  );
}
