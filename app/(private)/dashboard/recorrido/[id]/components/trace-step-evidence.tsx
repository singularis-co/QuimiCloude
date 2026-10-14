'use client';

import { useRouter } from 'next/navigation';

import { EvidenceStepList, StepEvidence, type StepEvidenceTile } from '@/components/shared/step-evidence';
import type { OrderEvidenceGroup } from '@/lib/modules/asignaciones';

export const MANUFACTURING_PHASE_LABEL = 'fabricación';

// Ancho del tablero: las 3 casillas no crecen con la columna de la anotación en escritorio.
const WRAPPER_CLASS = 'mt-1.5 w-full max-w-[372px]';

export type TraceStepEvidenceProps = {
  readonly group: OrderEvidenceGroup;
};

/** Las fotos de fabricación de un paso, bajo la anotación que las recoge. */
export function TraceStepEvidence({ group }: TraceStepEvidenceProps) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (group.photos === null) {
    return (
      <div className={WRAPPER_CLASS} data-testid="trace-step-evidence">
        <EvidenceStepList groups={[group]} phaseLabel={MANUFACTURING_PHASE_LABEL} onRetry={refresh} />
      </div>
    );
  }

  const tiles: StepEvidenceTile[] = [...group.photos]
    .sort((a, b) => a.slot - b.slot)
    .map((photo) => ({ id: photo.id, status: 'ok', url: photo.url }));

  return (
    <div className={WRAPPER_CLASS} data-testid="trace-step-evidence">
      <StepEvidence
        consult
        stepPosition={group.stepPosition}
        phaseLabel={MANUFACTURING_PHASE_LABEL}
        photos={tiles}
        onReload={refresh}
      />
    </div>
  );
}
