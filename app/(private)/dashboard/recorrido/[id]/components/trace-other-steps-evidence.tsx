'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';

import { EvidenceReadError, EvidenceStepList } from '@/components/shared/step-evidence';
import type { OrderEvidenceGroup } from '@/lib/modules/asignaciones';

import { MANUFACTURING_PHASE_LABEL } from './trace-step-evidence';

export const OTHER_STEPS_EVIDENCE_TEXTS = {
  title: 'Otros pasos con fotos',
  caption: 'Pasos de fabricación con fotos que no tienen ninguna anotación en el recorrido.',
} as const;

const FOOTER_CLASS = 'mt-1 flex flex-col gap-1 border-t border-border pt-4';

export type TraceOtherStepsEvidenceProps = {
  readonly groups: readonly OrderEvidenceGroup[];
};

/** Fotos de fabricación de pasos sin anotación, al final de Anotaciones. */
export function TraceOtherStepsEvidence({ groups }: TraceOtherStepsEvidenceProps) {
  const router = useRouter();
  const titleId = useId();
  if (groups.length === 0) return null;
  const refresh = () => router.refresh();

  return (
    <section aria-labelledby={titleId} data-testid="trace-other-steps-evidence" className={FOOTER_CLASS}>
      <h3 id={titleId} className="text-sm font-semibold">
        {OTHER_STEPS_EVIDENCE_TEXTS.title}
      </h3>
      <p className="m-0 mb-2 text-xs text-muted-foreground">{OTHER_STEPS_EVIDENCE_TEXTS.caption}</p>
      <div className="w-full max-w-[372px]">
        <EvidenceStepList
          groups={groups}
          phaseLabel={MANUFACTURING_PHASE_LABEL}
          onRetry={refresh}
          onReload={refresh}
        />
      </div>
    </section>
  );
}

/** El aviso único cuando no se pudo leer ninguna foto del pedido. */
export function TraceEvidenceReadError() {
  const router = useRouter();
  return (
    <div className={FOOTER_CLASS}>
      <EvidenceReadError onRetry={() => router.refresh()} testId="trace-evidence-read-error" />
    </div>
  );
}
