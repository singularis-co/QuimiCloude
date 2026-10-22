'use client';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';

import { STEP_EVIDENCE_TEXTS } from './step-evidence';

export type EvidenceReadErrorProps = {
  readonly onRetry: () => void;
  readonly testId?: string;
};

export function EvidenceReadError({ onRetry, testId }: EvidenceReadErrorProps) {
  return (
    <Notice tone="danger" testId={testId} className="items-center">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>{STEP_EVIDENCE_TEXTS.readError}</span>
        <Button type="button" variant="outline" size="sm" touch onClick={onRetry}>
          {STEP_EVIDENCE_TEXTS.retry}
        </Button>
      </span>
    </Notice>
  );
}
