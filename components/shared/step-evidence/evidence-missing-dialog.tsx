'use client';

import { ArrowRightIcon, CameraIcon } from 'lucide-react';

import { ConfirmDialogFrame } from '@/components/shared/confirm-dialog';
import {
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { touchTarget } from '@/lib/shared/ui/touch-target';

export const EVIDENCE_MISSING_TEXTS = {
  title: 'Falta evidencia',
  description:
    'Estos pasos piden al menos 1 foto y no tienen ninguna. Súbela para poder terminar.',
  step: (position: number) => `Paso ${position}`,
  close: 'Cerrar',
} as const;

export type EvidenceMissingDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Pasos, desde 1, que exigen evidencia y no tienen ninguna foto contada. */
  readonly positions: readonly number[];
  /** Se llama tras cerrar el diálogo con el paso elegido. */
  readonly onGoToStep: (position: number) => void;
};

export function EvidenceMissingDialog({
  open,
  onOpenChange,
  positions,
  onGoToStep,
}: EvidenceMissingDialogProps) {
  return (
    <ConfirmDialogFrame open={open} onOpenChange={onOpenChange} testId="evidence-missing-dialog">
      <AlertDialogHeader>
        <AlertDialogMedia className="bg-destructive/10 text-destructive">
          <CameraIcon aria-hidden />
        </AlertDialogMedia>
        <AlertDialogTitle>{EVIDENCE_MISSING_TEXTS.title}</AlertDialogTitle>
        <AlertDialogDescription>{EVIDENCE_MISSING_TEXTS.description}</AlertDialogDescription>
      </AlertDialogHeader>
      <ul className="flex flex-col gap-2" data-testid="evidence-missing-steps">
        {positions.map((position) => (
          <li key={position}>
            <Button
              type="button"
              variant="outline"
              touch
              className="w-full justify-between"
              data-testid={`evidence-missing-step-${position}`}
              onClick={() => {
                onOpenChange(false);
                onGoToStep(position);
              }}
            >
              {EVIDENCE_MISSING_TEXTS.step(position)}
              <ArrowRightIcon aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <AlertDialogFooter>
        <AlertDialogCancel className={touchTarget} data-testid="evidence-missing-close">
          {EVIDENCE_MISSING_TEXTS.close}
        </AlertDialogCancel>
      </AlertDialogFooter>
    </ConfirmDialogFrame>
  );
}
