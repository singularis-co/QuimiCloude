'use client';

import { useEffect, useRef, useState } from 'react';

import { ChevronLeftIcon, CircleCheckIcon } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Notice } from '@/components/shared/notice';
import { STEP_EVIDENCE_TEXTS } from '@/components/shared/step-evidence';
import { StepReader } from '@/components/shared/step-reader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ConditioningStepsView } from '@/lib/modules/asignaciones';
import {
  recordConditioningStepAction,
  type RecordConditioningStepActionResult,
} from '@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import { newRequestId } from '@/lib/modules/observabilidad';

import { useStepEvidence } from '../../../components/use-step-evidence';

import { ConditioningStepResponsiblesPicker } from './conditioning-step-responsibles-picker';

export const CONDITIONING_STEPS_PANEL_TESTID = 'conditioning-order-steps';
export const CONDITIONING_STEPS_DONE_TESTID = 'conditioning-steps-done';
export const CONDITIONING_STEPS_BACK_TESTID = 'conditioning-steps-back';
export const CONDITIONING_STEPS_RESUMED_TESTID = 'conditioning-steps-resumed';
export const CONDITIONING_STEPS_ERROR_TESTID = 'conditioning-steps-error';

export const CONDITIONING_STEPS_TEXTS = {
  title: 'Pasos de acondicionamiento',
  complete: 'Completar pasos',
  missingPhoto: 'Sube al menos una foto para avanzar.',
  missingResponsible: 'Elige al menos un responsable para avanzar.',
  doneTitle: 'Pasos completos',
  doneMessage: 'Guarda los datos de lote y pulsa «Terminar».',
  doneToast: 'Pasos completos.',
  backToSteps: 'Volver a los pasos',
  resumedTitle: 'Retomaste donde ibas',
  resumedBody: (current: number, total: number) =>
    `Paso ${current} de ${total}. Los responsables y las fotos de los pasos anteriores siguen guardados.`,
} as const;

const MIN_STEP_SECONDS = 5;

export type ConditioningStepsPanelView = 'steps' | 'done';

export type ConditioningStepsPanelProps = {
  readonly orderId: string;
  readonly conditioning: ConditioningStepsView;
  readonly view: ConditioningStepsPanelView;
  readonly onViewChange: (view: ConditioningStepsPanelView) => void;
  /** Pasos completados según la última respuesta del servidor. */
  readonly onCompletedChange: (completedCount: number) => void;
};

type ResponsiblesByStep = Readonly<Record<number, readonly string[]>>;

function initialResponsibles(conditioning: ConditioningStepsView): ResponsiblesByStep {
  const byStep: Record<number, readonly string[]> = {};
  for (const entry of conditioning.responsibles) byStep[entry.stepPosition] = entry.userIds;
  return byStep;
}

function unexpectedFromRejection(): ErrorState {
  return {
    status: 'error',
    code: UNEXPECTED_ERROR_CODE,
    message: errorMessage(UNEXPECTED_ERROR_CODE),
    reference: newRequestId(),
  };
}

/**
 * El paso a paso del acondicionador. Lo que llega por props solo se lee al montar: la acción
 * revalida la ruta y la respuesta trae props nuevas, que no deben mover el paso en curso ni
 * devolver lo elegido al estado guardado.
 */
export function ConditioningStepsPanel({
  orderId,
  conditioning,
  view,
  onViewChange,
  onCompletedChange,
}: ConditioningStepsPanelProps) {
  const { steps, candidates } = conditioning;
  const total = steps.length;
  const [entryPosition, setEntryPosition] = useState(() => Math.min(conditioning.completedCount + 1, total));
  const [readerMount, setReaderMount] = useState(0);
  const [resumed, setResumed] = useState(
    () => conditioning.completedCount > 0 && conditioning.completedCount < total,
  );
  const [responsibles, setResponsibles] = useState<ResponsiblesByStep>(() => initialResponsibles(conditioning));
  const [error, setError] = useState<ErrorState | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [stepRequest, setStepRequest] = useState<{ position: number; id: number }>();
  // En cola para que el servidor reciba los pasos en el orden en que se dejaron.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const doneRef = useRef<HTMLDivElement>(null);
  const mountedView = useRef<ConditioningStepsPanelView | null>(view);

  const evidence = useStepEvidence({
    orderId,
    phase: 'conditioning',
    steps,
    initial: conditioning.evidence,
  });

  // El pie cambia con la vista: sin mover el foco, se perdería con el botón que se va.
  useEffect(() => {
    if (view === mountedView.current) {
      mountedView.current = null;
      return;
    }
    mountedView.current = null;
    if (view === 'done') doneRef.current?.focus();
  }, [view]);

  function requiresAssignment(position: number): boolean {
    return steps[position - 1]?.requiresAssignment === true;
  }

  function responsiblesOf(position: number): readonly string[] {
    return responsibles[position] ?? [];
  }

  function stepBlockReason(position: number): string | null {
    const evidenceReason = evidence.stepBlockReason(position);
    if (evidenceReason === STEP_EVIDENCE_TEXTS.missingReason) return CONDITIONING_STEPS_TEXTS.missingPhoto;
    if (evidenceReason !== null) return evidenceReason;
    if (requiresAssignment(position) && responsiblesOf(position).length === 0) {
      return CONDITIONING_STEPS_TEXTS.missingResponsible;
    }
    return null;
  }

  function renderStepAddon(position: number) {
    const photos = evidence.renderStepAddon(position);
    if (!requiresAssignment(position)) return photos;
    return (
      <>
        {photos}
        <ConditioningStepResponsiblesPicker
          candidates={candidates}
          selected={responsiblesOf(position)}
          onChange={(next) => setResponsibles((current) => ({ ...current, [position]: next }))}
        />
      </>
    );
  }

  function record(position: number): Promise<RecordConditioningStepActionResult> {
    const responsibleUserIds = requiresAssignment(position) ? [...responsiblesOf(position)] : [];
    const sent = queue.current.then(() =>
      recordConditioningStepAction({ orderId, stepPosition: position, responsibleUserIds }),
    );
    queue.current = sent.then(
      () => undefined,
      () => undefined,
    );
    return sent.catch(unexpectedFromRejection);
  }

  function handleResult(result: RecordConditioningStepActionResult): boolean {
    if (result.status !== 'success') {
      setError(result);
      return false;
    }
    onCompletedChange(result.data.completedCount);
    return true;
  }

  function handleStepChange({ direction, position }: { direction: 'advance' | 'go_back'; position: number }) {
    setResumed(false);
    if (direction !== 'advance') return;
    const left = position - 1;
    setError(null);
    void record(left).then((result) => {
      if (handleResult(result)) return;
      setStepRequest((previous) => ({ position: left, id: (previous?.id ?? 0) + 1 }));
    });
  }

  function handleFinish() {
    if (finishing) return;
    setFinishing(true);
    setError(null);
    void record(total).then((result) => {
      setFinishing(false);
      if (!handleResult(result)) return;
      setResumed(false);
      toast.success(CONDITIONING_STEPS_TEXTS.doneToast);
      onViewChange('done');
    });
  }

  function backToSteps() {
    setEntryPosition(total);
    setStepRequest(undefined);
    setReaderMount((current) => current + 1);
    onViewChange('steps');
  }

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid={CONDITIONING_STEPS_PANEL_TESTID} data-view={view}>
      {resumed ? (
        <Notice tone="info" title={CONDITIONING_STEPS_TEXTS.resumedTitle} testId={CONDITIONING_STEPS_RESUMED_TESTID}>
          {CONDITIONING_STEPS_TEXTS.resumedBody(entryPosition, total)}
        </Notice>
      ) : null}

      {/* Encima del paso y no al final: el pie fijo del paso a paso taparía lo último. */}
      {error === null ? null : (
        <ErrorAlert
          error={error}
          testId={CONDITIONING_STEPS_ERROR_TESTID}
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          withDataCode
        />
      )}

      <Card>
        <CardContent>
          {view === 'done' ? (
            <div ref={doneRef} tabIndex={-1} className="outline-none">
              <EmptyState
                testId={CONDITIONING_STEPS_DONE_TESTID}
                className="flex flex-col items-center gap-3 px-3 py-6 text-center"
                icon={{ node: <CircleCheckIcon /> }}
                heading={{ text: CONDITIONING_STEPS_TEXTS.doneTitle, level: 2 }}
                message={CONDITIONING_STEPS_TEXTS.doneMessage}
              >
                <Button
                  type="button"
                  variant="outline"
                  touch
                  onClick={backToSteps}
                  data-testid={CONDITIONING_STEPS_BACK_TESTID}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                  {CONDITIONING_STEPS_TEXTS.backToSteps}
                </Button>
              </EmptyState>
            </div>
          ) : (
            <StepReader
              key={readerMount}
              steps={steps}
              title={CONDITIONING_STEPS_TEXTS.title}
              onFinish={handleFinish}
              minStepSeconds={MIN_STEP_SECONDS}
              mode="ejecucion"
              finishLabel={CONDITIONING_STEPS_TEXTS.complete}
              finishBusy={finishing}
              initialStepPosition={entryPosition}
              onStepChange={handleStepChange}
              renderStepAddon={renderStepAddon}
              stepBlockReason={stepBlockReason}
              stepRequest={stepRequest}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
