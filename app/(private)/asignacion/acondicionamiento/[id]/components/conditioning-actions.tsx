'use client';

import { useState } from 'react';

import { CheckIcon, PlayIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ConditioningTeamCandidates } from '@/lib/modules/asignaciones';

import { FinishConditioningDialog } from './finish-conditioning-dialog';
import { StartConditioningDialog } from './start-conditioning-dialog';

export const CONDITIONING_START_BUTTON_TESTID = 'conditioning-start-button';
export const CONDITIONING_FINISH_BUTTON_TESTID = 'conditioning-finish-button';
export const CONDITIONING_ACTIONS_REASON_TESTID = 'conditioning-actions-reason';

export const CONDITIONING_ACTIONS_TEXTS = {
  start: 'Comenzar el acondicionamiento',
  finish: 'Terminar el acondicionamiento',
  finished: 'Este pedido ya está acondicionado.',
  delivered: 'Este pedido ya está entregado.',
  noCandidates: 'No se pudo cargar el equipo para comenzar.',
} as const;

export type ConditioningActionsProps = {
  readonly orderId: string;
  readonly orderNumber: string;
  /** Con candidatos se ofrece «Comenzar». */
  readonly startCandidates?: ConditioningTeamCandidates | null;
  /** Se ofrece «Terminar»; tiene prioridad sobre «Comenzar». */
  readonly canFinish?: boolean;
  /** Deshabilita «Terminar» sin abrir el modal; el servidor sigue siendo quien rechaza. */
  readonly finishBlocked?: boolean;
  /** El aviso que explica por qué «Terminar» está deshabilitado. */
  readonly finishDescribedBy?: string;
  /** Si viene, el actor no puede actuar: no hay botones ni modales, solo esta línea. */
  readonly blockedReason?: string | null;
};

/** El botón del pie del acondicionamiento que toca por el estado, con su modal, o el motivo de no tenerlo. */
export function ConditioningActions({
  orderId,
  orderNumber,
  startCandidates = null,
  canFinish = false,
  finishBlocked = false,
  finishDescribedBy,
  blockedReason = null,
}: ConditioningActionsProps) {
  const [open, setOpen] = useState(false);
  // Cada apertura monta el modal de cero: la espera vuelve a empezar y no queda nada de la anterior.
  const [opening, setOpening] = useState(0);

  function openDialog(): void {
    setOpening((current) => current + 1);
    setOpen(true);
  }

  function handleOpenChange(next: boolean): void {
    if (!next) setOpen(false);
  }

  if (blockedReason !== null && blockedReason !== '') {
    return (
      <p
        role="status"
        className="text-center text-base text-muted-foreground"
        data-testid={CONDITIONING_ACTIONS_REASON_TESTID}
      >
        {blockedReason}
      </p>
    );
  }

  if (canFinish) {
    return (
      <div className="mx-auto flex w-full max-w-[360px] flex-col">
        <Button
          type="button"
          size="xl"
          onClick={finishBlocked ? undefined : openDialog}
          disabled={finishBlocked}
          aria-describedby={finishDescribedBy}
          data-testid={CONDITIONING_FINISH_BUTTON_TESTID}
        >
          <CheckIcon aria-hidden="true" />
          {CONDITIONING_ACTIONS_TEXTS.finish}
        </Button>
        <FinishConditioningDialog
          key={`finish-${opening}`}
          open={open}
          onOpenChange={handleOpenChange}
          orderId={orderId}
          orderNumber={orderNumber}
        />
      </div>
    );
  }

  if (startCandidates !== null) {
    return (
      <div className="mx-auto flex w-full max-w-[360px] flex-col">
        <Button type="button" size="xl" onClick={openDialog} data-testid={CONDITIONING_START_BUTTON_TESTID}>
          <PlayIcon aria-hidden="true" />
          {CONDITIONING_ACTIONS_TEXTS.start}
        </Button>
        <StartConditioningDialog
          key={`start-${opening}`}
          open={open}
          onOpenChange={handleOpenChange}
          orderId={orderId}
          orderNumber={orderNumber}
          candidates={startCandidates}
        />
      </div>
    );
  }

  return null;
}
