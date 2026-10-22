'use client';

import { useState } from 'react';

import { CheckIcon, PlayIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ConditioningTeamCandidates } from '@/lib/modules/asignaciones';

import { FinishConditioningDialog } from './finish-conditioning-dialog';
import { StartConditioningDialog } from './start-conditioning-dialog';

export const CONDITIONING_START_BUTTON_TESTID = 'conditioning-start-button';
export const CONDITIONING_FINISH_BUTTON_TESTID = 'conditioning-finish-button';

export const CONDITIONING_ACTIONS_TEXTS = {
  start: 'Acondicionar',
  finish: 'Terminar',
} as const;

export type ConditioningActionsProps = {
  readonly orderId: string;
  readonly orderNumber: string;
  /** Con candidatos se habilita «Acondicionar»; sin ellos se pinta deshabilitado. */
  readonly startCandidates?: ConditioningTeamCandidates | null;
  /** Se habilita «Terminar» (salvo `finishBlocked`). */
  readonly canFinish?: boolean;
  /** Deshabilita «Terminar» sin abrir el modal; el servidor sigue siendo quien rechaza. */
  readonly finishBlocked?: boolean;
  /** El aviso que explica por qué «Terminar» está deshabilitado. */
  readonly finishDescribedBy?: string;
};

/**
 * Los dos botones del pie del acondicionamiento. Siempre se pintan los dos; se habilita, como
 * mucho, el que toca por el estado del pedido, y solo ese monta su modal.
 */
export function ConditioningActions({
  orderId,
  orderNumber,
  startCandidates = null,
  canFinish = false,
  finishBlocked = false,
  finishDescribedBy,
}: ConditioningActionsProps) {
  const [openDialog, setOpenDialog] = useState<'start' | 'finish' | null>(null);
  // Cada apertura monta el modal de cero: la espera vuelve a empezar y no queda nada de la anterior.
  const [opening, setOpening] = useState(0);

  function open(kind: 'start' | 'finish'): void {
    setOpening((current) => current + 1);
    setOpenDialog(kind);
  }

  function handleOpenChange(next: boolean): void {
    if (!next) setOpenDialog(null);
  }

  const startEnabled = startCandidates !== null;
  const finishEnabled = canFinish && !finishBlocked;

  return (
    <div className="grid w-full max-w-[520px] grid-cols-2 gap-3">
      <Button
        type="button"
        size="xl"
        variant={startEnabled ? 'default' : 'outline'}
        onClick={startEnabled ? () => open('start') : undefined}
        disabled={!startEnabled}
        data-testid={CONDITIONING_START_BUTTON_TESTID}
      >
        <PlayIcon aria-hidden="true" />
        {CONDITIONING_ACTIONS_TEXTS.start}
      </Button>
      <Button
        type="button"
        size="xl"
        variant={canFinish ? 'default' : 'outline'}
        onClick={finishEnabled ? () => open('finish') : undefined}
        disabled={!finishEnabled}
        aria-describedby={canFinish ? finishDescribedBy : undefined}
        data-testid={CONDITIONING_FINISH_BUTTON_TESTID}
      >
        <CheckIcon aria-hidden="true" />
        {CONDITIONING_ACTIONS_TEXTS.finish}
      </Button>

      {startCandidates === null ? null : (
        <StartConditioningDialog
          key={`start-${opening}`}
          open={openDialog === 'start'}
          onOpenChange={handleOpenChange}
          orderId={orderId}
          orderNumber={orderNumber}
          candidates={startCandidates}
        />
      )}
      {canFinish ? (
        <FinishConditioningDialog
          key={`finish-${opening}`}
          open={openDialog === 'finish'}
          onOpenChange={handleOpenChange}
          orderId={orderId}
          orderNumber={orderNumber}
        />
      ) : null}
    </div>
  );
}
