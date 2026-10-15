import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Ban,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Download,
  Package,
  Play,
  RotateCcw,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import {
  EXECUTION_ACTION_LABELS,
  GO_BACK_MARK,
  formatElapsed,
  formatTraceInstant,
} from '@/app/(private)/dashboard/components';
import type { ExecutionAction, ExecutionTraceDetailStep } from '@/lib/modules/asignaciones';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { getInitials } from '@/lib/shared/ui/initials';
import type { StatusTone } from '@/lib/shared/ui/status-tone';

import { ConditioningBatchSaveBody, ConditioningStartBody, MISSING_DATA_LABEL } from './conditioning-step-details';

const HEADING_TEXT = 'Anotaciones';
const HEADING_ID = 'execution-trace-annotations';
const STEP_STAGGER_MS = 40;

type TimelineTone = Extract<StatusTone, 'neutral' | 'progress' | 'waiting' | 'success' | 'danger'>;

export const EXECUTION_TIMELINE_ACTIONS: Record<
  ExecutionAction,
  { readonly tone: TimelineTone; readonly icon: LucideIcon }
> = {
  start: { tone: 'progress', icon: Play },
  resume: { tone: 'progress', icon: Play },
  pack_start: { tone: 'progress', icon: Package },
  advance: { tone: 'neutral', icon: ArrowRight },
  go_back: { tone: 'waiting', icon: RotateCcw },
  finish: { tone: 'success', icon: CircleCheck },
  pack_finish: { tone: 'success', icon: Package },
  cancel: { tone: 'danger', icon: Ban },
  conditioning_start: { tone: 'progress', icon: ClipboardList },
  conditioning_batch_save: { tone: 'neutral', icon: Download },
  conditioning_finish: { tone: 'success', icon: ClipboardCheck },
};

const DOT_TONE_CLASS: Record<TimelineTone, string> = {
  neutral: 'border-status-neutral-dot bg-status-neutral-subtle text-status-neutral-text',
  progress: 'border-status-progress-dot bg-status-progress-subtle text-status-progress-text',
  waiting: 'border-warning bg-warning-subtle text-warning-text',
  success: 'border-success bg-success-subtle text-success-text',
  danger: 'border-destructive bg-destructive-subtle text-destructive-text',
};

const STEP_ENTER_CLASS = 'motion-safe:animate-[screen-enter_var(--dur-slow)_var(--ease-enter)_both]';

const BODY_BASE_CLASS = 'flex min-w-0 flex-col gap-1.5 rounded-xl border px-3.5 py-2.5 transition-[border-color,box-shadow]';
// Tailwind 4 solo aplica `hover:` con `@media (hover: hover)`: en táctil no hay realce.
const BODY_HOVER_CLASS = 'hover:border-primary/40 hover:shadow-md';
const BODY_DEFAULT_CLASS = 'border-border bg-card';
const BODY_GO_BACK_CLASS = 'border-warning-border bg-warning-subtle/55';
const STEP_META_CLASS = 'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground';

function StepPerson({ step }: { readonly step: ExecutionTraceDetailStep }) {
  if (step.userDisplayName === null) {
    return (
      <span aria-label={MISSING_DATA_LABEL} data-testid="execution-trace-step-person">
        {EMPTY_MARK}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground" data-testid="execution-trace-step-person">
      <Avatar size="sm" tone={avatarTone(step.userId)} aria-hidden="true" data-testid="execution-trace-step-avatar">
        <AvatarFallback>{getInitials(step.userDisplayName)}</AvatarFallback>
      </Avatar>
      {step.userDisplayName}
    </span>
  );
}

function StepBody({ step }: { readonly step: ExecutionTraceDetailStep }) {
  switch (step.action) {
    case 'conditioning_start':
      return <ConditioningStartBody supervisor={<StepPerson step={step} />} team={step.team} />;
    case 'conditioning_batch_save':
      return <ConditioningBatchSaveBody savedBy={<StepPerson step={step} />} lines={step.lines} />;
    case 'conditioning_finish':
      return (
        <div className={STEP_META_CLASS}>
          <StepPerson step={step} />
        </div>
      );
    default:
      return (
        <>
          <div className={STEP_META_CLASS}>
            {step.stepPosition === null ? null : (
              <span data-testid="execution-trace-step-position">Paso {step.stepPosition}</span>
            )}
            <StepPerson step={step} />
          </div>
          {step.action === 'cancel' && step.reason !== null ? (
            <p className="m-0 text-xs text-foreground" data-testid="execution-trace-step-reason">
              <span className="font-semibold">Motivo</span> · {step.reason}
            </p>
          ) : null}
        </>
      );
  }
}

function TimelineStep({ step, index }: { readonly step: ExecutionTraceDetailStep; readonly index: number }) {
  const { tone, icon: Icon } = EXECUTION_TIMELINE_ACTIONS[step.action];
  return (
    <li
      data-testid="execution-trace-step"
      data-action={step.action}
      data-go-back={step.isGoBack ? 'true' : undefined}
      data-tone={tone}
      className={`relative grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3.5 py-2 ${STEP_ENTER_CLASS}`}
      style={{ animationDelay: `${index * STEP_STAGGER_MS}ms` }}
    >
      <span
        aria-hidden="true"
        data-testid="execution-trace-step-dot"
        className={`relative z-10 flex size-10 items-center justify-center rounded-full border-2 ${DOT_TONE_CLASS[tone]}`}
      >
        <Icon className="size-4" />
      </span>
      <div
        className={`${BODY_BASE_CLASS} ${step.isGoBack ? BODY_GO_BACK_CLASS : BODY_DEFAULT_CLASS} ${BODY_HOVER_CLASS}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <strong className="font-semibold" data-testid="execution-trace-step-action">
            {EXECUTION_ACTION_LABELS[step.action]}
          </strong>
          <time
            dateTime={step.occurredAt.toISOString()}
            className="font-mono text-xs text-muted-foreground"
            data-testid="execution-trace-step-instant"
          >
            {formatTraceInstant(step.occurredAt)}
          </time>
        </div>
        <StepBody step={step} />
        {step.gapToNextMs === null ? null : (
          <p className="m-0 text-xs text-muted-foreground" data-testid="execution-trace-step-gap">
            Hasta la siguiente: {formatElapsed(step.gapToNextMs)}
          </p>
        )}
        {step.isGoBack ? (
          <span className="sr-only" data-testid="execution-trace-step-go-back">
            {GO_BACK_MARK}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export type ExecutionTimelineProps = {
  readonly steps: readonly ExecutionTraceDetailStep[];
};

export function ExecutionTimeline({ steps }: ExecutionTimelineProps) {
  return (
    <Card className="px-4" data-testid="execution-trace-timeline">
      <div className="flex items-center gap-2">
        <h2 id={HEADING_ID} className="text-base font-semibold">
          {HEADING_TEXT}
        </h2>
        <span
          className="rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground"
          data-testid="execution-trace-step-count"
        >
          {steps.length}
        </span>
      </div>
      <ol
        aria-labelledby={HEADING_ID}
        className="relative m-0 list-none p-0 before:absolute before:top-5 before:bottom-5 before:left-[19px] before:w-0.5 before:bg-border"
      >
        {steps.map((step, index) => (
          <TimelineStep key={step.id} step={step} index={index} />
        ))}
      </ol>
    </Card>
  );
}
