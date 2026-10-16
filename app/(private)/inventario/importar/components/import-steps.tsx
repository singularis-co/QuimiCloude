import { cn } from '@/lib/utils';

import { IMPORT_STEPS_LABEL, IMPORT_STEPS_TESTID, IMPORT_STEP_LABELS, importStepTestId } from './import-texts';

export type ImportStep = 1 | 2 | 3;

const STEPS: readonly ImportStep[] = [1, 2, 3];

export function importStepOf(outcome: { readonly kind: string } | null): ImportStep {
  switch (outcome?.kind) {
    case 'preview':
      return 2;
    case 'imported':
    case 'nothing_imported':
    case 'already_imported':
      return 3;
    default:
      return 1;
  }
}

// Los pasos solo informan: no son pestañas ni botones, así que no reciben el foco.
export function ImportSteps({ current }: { readonly current: ImportStep }) {
  return (
    <ol
      aria-label={IMPORT_STEPS_LABEL}
      data-testid={IMPORT_STEPS_TESTID}
      className="flex w-fit max-w-full min-w-0 flex-nowrap gap-1 overflow-x-auto rounded-[10px] bg-muted p-1 [scrollbar-width:none]"
    >
      {STEPS.map((step) => {
        const isCurrent = step === current;
        return (
          <li
            key={step}
            aria-current={isCurrent ? 'step' : undefined}
            data-testid={importStepTestId(step)}
            className={cn(
              'flex min-h-9 flex-none items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-[background-color,color,box-shadow] duration-(--dur-base) ease-(--ease-standard)',
              isCurrent && 'bg-card text-foreground shadow-xs ring-1 ring-border',
            )}
          >
            <span
              aria-hidden="true"
              data-slot="import-step-number"
              className="inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-foreground/8 px-1.5 text-[11px] font-semibold tabular-nums"
            >
              {step}
            </span>
            <span>{IMPORT_STEP_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
