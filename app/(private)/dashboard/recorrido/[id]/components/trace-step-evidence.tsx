'use client';

import { useRouter } from 'next/navigation';

import {
  EvidenceGroupHeader,
  EvidenceReadError,
  STEP_EVIDENCE_TEXTS,
  StepEvidence,
  type StepEvidenceTile,
} from '@/components/shared/step-evidence';
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
        <div
          role="group"
          aria-label={STEP_EVIDENCE_TEXTS.groupLabel(MANUFACTURING_PHASE_LABEL, group.stepPosition)}
          className="flex flex-col gap-2"
        >
          <EvidenceGroupHeader title={STEP_EVIDENCE_TEXTS.heading} count={group.photoCount} />
          <EvidenceReadError onRetry={refresh} />
        </div>
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
