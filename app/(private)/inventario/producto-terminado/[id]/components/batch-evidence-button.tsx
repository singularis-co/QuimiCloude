'use client';

import { useState } from 'react';
import { CameraIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { BATCH_EVIDENCE_TEXTS, BatchEvidenceDialog } from './batch-evidence-dialog';

export type BatchEvidenceButtonProps = {
  readonly lot: string;
  readonly orderId: string;
  readonly orderNumberText: string;
  readonly photoCount: number;
};

export function BatchEvidenceButton({ lot, orderId, orderNumberText, photoCount }: BatchEvidenceButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        touch
        data-testid="batch-evidence-button"
        aria-label={BATCH_EVIDENCE_TEXTS.open(lot, photoCount)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <CameraIcon aria-hidden />
        <span className="font-mono">{BATCH_EVIDENCE_TEXTS.photos(photoCount)}</span>
      </Button>
      <BatchEvidenceDialog
        open={open}
        onOpenChange={setOpen}
        lot={lot}
        orderId={orderId}
        orderNumberText={orderNumberText}
        photoCount={photoCount}
      />
    </>
  );
}
