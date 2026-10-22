'use client';

import type { OrderEvidenceGroup } from '@/lib/modules/asignaciones';

import { EvidenceReadError } from './evidence-read-error';
import { EvidenceGroupHeader, STEP_EVIDENCE_TEXTS, StepEvidence, type StepEvidenceTile } from './step-evidence';

export type EvidenceStepListProps = {
  readonly groups: readonly OrderEvidenceGroup[];
  /** Fase en minúscula, como se lee en «Evidencia de <fase>, paso N». */
  readonly phaseLabel: string;
  /** Vuelve a pedir las fotos de un grupo que no se pudo leer. */
  readonly onRetry: () => void;
  /** Pide lecturas firmadas nuevas cuando una miniatura no carga. */
  readonly onReload?: () => void;
  readonly testId?: string;
};

function toTiles(photos: NonNullable<OrderEvidenceGroup['photos']>): StepEvidenceTile[] {
  return [...photos]
    .sort((a, b) => a.slot - b.slot)
    .map((photo) => ({ id: photo.id, status: 'ok', url: photo.url }));
}

export function EvidenceStepList({ groups, phaseLabel, onRetry, onReload, testId }: EvidenceStepListProps) {
  if (groups.length === 0) return null;
  const ordered = [...groups].sort((a, b) => a.stepPosition - b.stepPosition);

  return (
    <div data-testid={testId} className="flex flex-col">
      {ordered.map((group) => {
        const heading = STEP_EVIDENCE_TEXTS.stepHeading(group.stepPosition);
        return (
          <div
            key={group.stepPosition}
            data-testid="evidence-step-row"
            data-step={group.stepPosition}
            className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0"
          >
            {group.photos === null ? (
              <div
                role="group"
                aria-label={STEP_EVIDENCE_TEXTS.groupLabel(phaseLabel, group.stepPosition)}
                className="flex flex-col gap-2"
              >
                <EvidenceGroupHeader title={heading} count={group.photoCount} />
                <EvidenceReadError onRetry={onRetry} />
              </div>
            ) : (
              <StepEvidence
                consult
                stepPosition={group.stepPosition}
                phaseLabel={phaseLabel}
                heading={heading}
                photos={toTiles(group.photos)}
                onReload={onReload}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
