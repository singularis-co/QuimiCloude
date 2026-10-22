import { useId } from 'react';

import { CheckIcon, UserPlusIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { ConditioningStepCandidateView } from '@/lib/modules/asignaciones';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';
import { getInitials } from '@/lib/shared/ui/initials';

export const CONDITIONING_STEP_RESPONSIBLES_TESTID = 'conditioning-step-responsibles';
export const CONDITIONING_STEP_RESPONSIBLE_TESTID = 'conditioning-step-responsible';
export const CONDITIONING_STEP_RESPONSIBLES_COUNT_TESTID = 'conditioning-step-responsibles-count';

export const CONDITIONING_STEP_RESPONSIBLES_TEXTS = {
  title: 'Responsables del paso',
  help: 'Elige uno o más del equipo que hicieron este paso. Puedes elegirte a ti.',
  self: '(tú)',
  none: 'Ninguno elegido',
  count: (count: number) => (count === 1 ? '1 elegido' : `${count} elegidos`),
} as const;

export type ConditioningStepResponsiblesPickerProps = {
  /** Quien acondiciona primero, con `isSelf`, y después el equipo. */
  readonly candidates: readonly ConditioningStepCandidateView[];
  readonly selected: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
};

/** Selección múltiple de quién hizo el paso: un botón conmutable por persona, sin depender de hover. */
export function ConditioningStepResponsiblesPicker({
  candidates,
  selected,
  onChange,
}: ConditioningStepResponsiblesPickerProps) {
  const headingId = useId();
  const chosen = new Set(selected);

  function toggle(userId: string): void {
    onChange(chosen.has(userId) ? selected.filter((id) => id !== userId) : [...selected, userId]);
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-testid={CONDITIONING_STEP_RESPONSIBLES_TESTID}
      data-state={selected.length === 0 ? 'empty' : 'chosen'}
      className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 data-[state=empty]:border-primary/45"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={headingId} className="inline-flex items-center gap-2 text-base font-semibold">
          <UserPlusIcon aria-hidden="true" className="size-4" />
          {CONDITIONING_STEP_RESPONSIBLES_TEXTS.title}
        </span>
        <span
          aria-live="polite"
          className="text-sm text-muted-foreground"
          data-testid={CONDITIONING_STEP_RESPONSIBLES_COUNT_TESTID}
        >
          {selected.length === 0
            ? CONDITIONING_STEP_RESPONSIBLES_TEXTS.none
            : CONDITIONING_STEP_RESPONSIBLES_TEXTS.count(selected.length)}
        </span>
      </div>
      <p className="m-0 text-sm text-muted-foreground">{CONDITIONING_STEP_RESPONSIBLES_TEXTS.help}</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => {
          const pressed = chosen.has(candidate.userId);
          return (
            <Button
              key={candidate.userId}
              type="button"
              variant="outline"
              aria-pressed={pressed}
              onClick={() => toggle(candidate.userId)}
              data-testid={CONDITIONING_STEP_RESPONSIBLE_TESTID}
              data-user-id={candidate.userId}
              className="h-auto min-h-12 gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-sm font-medium aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              <Avatar size="sm" tone={avatarTone(candidate.userId)}>
                <AvatarFallback>{getInitials(candidate.displayName)}</AvatarFallback>
              </Avatar>
              {candidate.displayName}
              {candidate.isSelf ? (
                <span className="text-muted-foreground">{CONDITIONING_STEP_RESPONSIBLES_TEXTS.self}</span>
              ) : null}
              <CheckIcon
                aria-hidden="true"
                className={pressed ? 'size-4 text-primary' : 'size-4 text-primary opacity-0'}
              />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
