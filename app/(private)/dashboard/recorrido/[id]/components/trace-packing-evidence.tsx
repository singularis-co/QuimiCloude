'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';

import { EvidenceStepList } from '@/components/shared/step-evidence';
import { Card } from '@/components/ui/card';
import type { OrderEvidenceGroup } from '@/lib/modules/asignaciones';

export const PACKING_EVIDENCE_TEXTS = {
  title: 'Envasado',
  phase: 'envasado',
  countLabel: (total: number) => `${total} ${total === 1 ? 'foto' : 'fotos'} de envasado`,
} as const;

export type TracePackingEvidenceProps = {
  readonly groups: readonly OrderEvidenceGroup[];
};

/** Las fotos de envasado del pedido, en su propia tarjeta después de Anotaciones. */
export function TracePackingEvidence({ groups }: TracePackingEvidenceProps) {
  const router = useRouter();
  const titleId = useId();
  if (groups.length === 0) return null;
  const refresh = () => router.refresh();
  const total = groups.reduce((sum, group) => sum + group.photoCount, 0);

  return (
    <Card role="region" aria-labelledby={titleId} className="px-4" data-testid="trace-packing-evidence">
      <div className="flex items-center gap-2">
        <h2 id={titleId} className="text-base font-semibold">
          {PACKING_EVIDENCE_TEXTS.title}
        </h2>
        <span
          aria-label={PACKING_EVIDENCE_TEXTS.countLabel(total)}
          className="rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground"
          data-testid="trace-packing-evidence-count"
        >
          {total}
        </span>
      </div>
      <div className="w-full max-w-[372px]">
        <EvidenceStepList
          groups={groups}
          phaseLabel={PACKING_EVIDENCE_TEXTS.phase}
          onRetry={refresh}
          onReload={refresh}
        />
      </div>
    </Card>
  );
}
