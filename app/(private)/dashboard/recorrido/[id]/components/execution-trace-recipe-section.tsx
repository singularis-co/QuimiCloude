import { StatusBadge } from '@/components/shared/status-badge';
import { formatElapsed } from '@/app/(private)/dashboard/components';
import type { ExecutionPhase, ExecutionTraceRecipe } from '@/lib/modules/asignaciones';
import { formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';
import { formatPresentationQuantities } from '@/lib/shared/ui/presentation-quantities';

import { ExecutionTimeline, type TraceEvidenceResult } from './execution-timeline';
import { PhaseDuration, STAT_GRID_CLASS } from './execution-trace-stat';
import { TracePackingEvidence } from './trace-packing-evidence';

export const EXECUTION_TRACE_RECIPE_SECTION_TESTID = 'execution-trace-recipe-section';

export const RECIPE_SECTION_TEXTS = {
  separator: ' · ',
  goBacks: 'vueltas atrás',
} as const;

const PHASE_ORDER: readonly ExecutionPhase[] = ['production', 'packing', 'conditioning'];

function quantityText(recipe: ExecutionTraceRecipe): string {
  const quantity = formatDecimalDisplay(recipe.quantity);
  return recipe.unitLabel === null ? quantity : `${quantity} ${recipe.unitLabel}`;
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

export type ExecutionTraceRecipeSectionProps = {
  readonly recipe: ExecutionTraceRecipe;
  /** Solo las fotos de esta receta. */
  readonly evidence?: TraceEvidenceResult;
};

/** Una receta del pedido: su cabecera, su línea de tiempo y sus fotos, sin nada de las demás. */
export function ExecutionTraceRecipeSection({ recipe, evidence }: ExecutionTraceRecipeSectionProps) {
  const titleId = `execution-trace-recipe-${recipe.lineId}`;
  const presentations =
    recipe.presentations.length === 0 ? EMPTY_MARK : formatPresentationQuantities(recipe.presentations);
  const packing = evidence?.status === 'success' ? evidence.data.packing : [];
  const phases = PHASE_ORDER.flatMap((phase) => {
    const duration = recipe.durations[phase];
    return duration === null ? [] : [[phase, duration] as const];
  });

  return (
    <section
      aria-labelledby={titleId}
      data-testid={EXECUTION_TRACE_RECIPE_SECTION_TESTID}
      data-line-id={recipe.lineId}
      data-status={recipe.status}
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-[18px]"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={titleId} className="text-lg font-semibold" data-testid="execution-trace-recipe-name">
          {recipe.recipeName ?? EMPTY_MARK}
        </h2>
        <StatusBadge
          tone={ORDER_STATUS_TONES[recipe.status]}
          label={ORDER_STATUS_LABELS[recipe.status]}
          data-testid="execution-trace-recipe-status"
          data-status={recipe.status}
        />
      </div>
      <p
        className="m-0 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground"
        data-testid="execution-trace-recipe-summary"
      >
        <span className="font-mono" data-testid="execution-trace-recipe-quantity">
          {quantityText(recipe)}
        </span>
        <span aria-hidden="true">{RECIPE_SECTION_TEXTS.separator}</span>
        <span data-testid="execution-trace-recipe-presentations">{presentations}</span>
        <span aria-hidden="true">{RECIPE_SECTION_TEXTS.separator}</span>
        <span className="font-mono" data-testid="execution-trace-recipe-duration" data-kind={recipe.totalDuration.kind}>
          {formatElapsed(recipe.totalDuration.ms)}
        </span>
        <span aria-hidden="true">{RECIPE_SECTION_TEXTS.separator}</span>
        <span className="inline-flex items-center gap-1">
          {RECIPE_SECTION_TEXTS.goBacks} <GoBackCount count={recipe.goBackCount} />
        </span>
      </p>
      {phases.length > 0 ? (
        <dl className={STAT_GRID_CLASS}>
          {phases.map(([phase, duration]) => (
            <PhaseDuration key={phase} phase={phase} duration={duration} />
          ))}
        </dl>
      ) : null}
      <ExecutionTimeline
        steps={recipe.steps}
        evidence={evidence}
        headingId={`execution-trace-annotations-${recipe.lineId}`}
        headingLevel={3}
      />
      {packing.length > 0 ? <TracePackingEvidence groups={packing} headingLevel={3} /> : null}
    </section>
  );
}
