'use client';

import { useActionState, useRef, useState } from 'react';

import { BanIcon } from 'lucide-react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { OrderDistributionLabel } from '@/components/shared/order-distribution-label';
import { RowActionsMenu } from '@/components/shared/row-actions-menu';
import { StepReader } from '@/components/shared/step-reader';
import { clampStepPosition } from '@/components/shared/step-reader/step-reader';
import type { StartedOrderExecution } from '@/lib/modules/asignaciones';
import {
  finishAssignedOrderAction,
  recordStepMoveAction,
  type FinishAssignedOrderResult,
} from '@/lib/modules/asignaciones/adapters/driving/order-execution-actions';
import { exactDecimalTitle, formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';

import {
  OperatorScreenFrame,
  STEP_READER_SIDE_COLUMN_RESERVE,
} from '../../components/operator-screen-frame';

import { ORDER_CANCEL_TEXTS, ORDER_CANCEL_TRIGGER_TESTID, OrderCancelDialog } from './order-cancel-dialog';
import { OrderExecutionToolsPanel } from './order-execution-tools-panel';

/**
 * El recorrido completo de la pantalla: monta `StepReader` por props y termina en
 * Finalizar. No hay ningun control de edicion: la receta, sus pasos y sus
 * lineas se leen tal cual llegaron.
 *
 * `finishAssignedOrderAction` termina, en el servidor, con una redireccion a la lista de pedidos
 * asignados: el camino feliz de esta pantalla nunca resuelve, la navegacion ocurre en el
 * servidor.
 */

export const ORDER_EXECUTION_SCREEN_TESTID = 'order-execution-screen';
export const ORDER_EXECUTION_FINISH_ERROR_TESTID = 'order-execution-finish-error';
export const ORDER_EXECUTION_FINISH_FORM_TESTID = 'order-execution-finish-form';
export const ORDER_EXECUTION_ORDER_ID_FIELD = 'orderId';
export const ORDER_EXECUTION_STEP_POSITION_FIELD = 'stepPosition';
export const ORDER_EXECUTION_TITLE_TESTID = 'order-execution-title';
export const ORDER_EXECUTION_ACTIONS_TESTID = 'order-execution-actions';
export const ORDER_EXECUTION_ORDER_QUANTITY_TESTID = 'order-execution-order-quantity';
export const ORDER_EXECUTION_PRESENTATION_TESTID = 'order-execution-presentation';
export const ORDER_EXECUTION_FINISH_DIALOG_TESTID = 'order-execution-finish-dialog';
export const ORDER_EXECUTION_FINISH_CONFIRM_TESTID = 'order-execution-finish-confirm';

export const ORDER_EXECUTION_FINISH_CONFIRM_TEXTS = {
  title: '¿Terminar el pedido?',
  description: 'Terminar el pedido no se puede deshacer.',
  cancel: 'Cancelar',
  confirm: 'Terminar',
} as const;

export const ORDER_EXECUTION_TEXTS = {
  recipeMissing: 'Esta receta está dada de baja.',
  orderQuantity: 'Pedido',
  presentation: 'Presentación:',
  actions: (numberText: string) => `Acciones del pedido ${numberText}`,
} as const;

const MIN_STEP_SECONDS = 5;

type FinishFormState = { readonly status: 'idle' } | FinishAssignedOrderResult;

const INITIAL_STATE: FinishFormState = { status: 'idle' };
/** `finishAssignedOrderAction` ignora su primer parametro (ver su propia firma): cualquier valor
 *  del tipo que espera sirve para adaptar el estado local, que ademas admite `'idle'`. */
const IGNORED_PREV_STATE: FinishAssignedOrderResult = { status: 'success' };

type StepChange = { readonly direction: 'advance' | 'go_back'; readonly position: number };

export type OrderExecutionScreenProps = {
  readonly execution: StartedOrderExecution;
};

export function OrderExecutionScreen({ execution }: OrderExecutionScreenProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stepPosition, setStepPosition] = useState(() =>
    clampStepPosition(execution.resumeStepPosition, execution.steps.length),
  );
  // Encadenadas para que lleguen en el orden de los clics; un fallo se pierde sin avisar.
  const stepMoves = useRef<Promise<void>>(Promise.resolve());
  const [state, formAction] = useActionState<FinishFormState, FormData>(
    (_previous, formData) => finishAssignedOrderAction(IGNORED_PREV_STATE, formData),
    INITIAL_STATE,
  );

  const error = state.status === 'error' ? state : undefined;

  function handleStepChange({ direction, position }: StepChange) {
    setStepPosition(position);
    stepMoves.current = stepMoves.current
      .then(() => recordStepMoveAction({ orderId: execution.orderId, direction, stepPosition: position }))
      .then(
        () => undefined,
        () => undefined,
      );
  }
  const actionsLabel = ORDER_EXECUTION_TEXTS.actions(execution.numberText);

  return (
    <OperatorScreenFrame
      testId={ORDER_EXECUTION_SCREEN_TESTID}
      eyebrow={execution.numberText}
      title={execution.recipeName ?? ORDER_EXECUTION_TEXTS.recipeMissing}
      titleTestId={ORDER_EXECUTION_TITLE_TESTID}
      subtitle={
        <>
          <span
            data-testid={ORDER_EXECUTION_ORDER_QUANTITY_TESTID}
            title={exactDecimalTitle(execution.orderQuantity)}
          >
            {ORDER_EXECUTION_TEXTS.orderQuantity} {formatDecimalDisplay(execution.orderQuantity)}
            {execution.unitLabel === null ? null : ` ${execution.unitLabel}`}
          </span>
          <span aria-hidden="true">{' · '}</span>
          <span data-testid={ORDER_EXECUTION_PRESENTATION_TESTID}>
            {ORDER_EXECUTION_TEXTS.presentation}{' '}
            <OrderDistributionLabel lines={execution.presentationLines} />
          </span>
        </>
      }
      headerActions={
        <RowActionsMenu
          triggerLabel={actionsLabel}
          triggerTestId={ORDER_EXECUTION_ACTIONS_TESTID}
          title={actionsLabel}
          items={[
            {
              key: 'cancel',
              label: ORDER_CANCEL_TEXTS.trigger,
              icon: BanIcon,
              destructive: true,
              testId: ORDER_CANCEL_TRIGGER_TESTID,
              onSelect: () => setCancelOpen(true),
            },
          ]}
        />
      }
    >
      <div className="grid grid-cols-1 items-start gap-5 @min-[1101px]:grid-cols-[300px_minmax(0,720px)] @min-[1101px]:justify-center @min-[1101px]:gap-x-6">
        <OrderExecutionToolsPanel
          className={STEP_READER_SIDE_COLUMN_RESERVE}
          tools={execution.tools}
          lines={execution.lines}
        />

        <div className="flex min-w-0 flex-col gap-4">
          {/* Encima del paso y no al final: el pie fijo del paso a paso taparía lo último. */}
          {error !== undefined ? (
            <ErrorAlert
              error={error}
              testId={ORDER_EXECUTION_FINISH_ERROR_TESTID}
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            />
          ) : null}
          <StepReader
            steps={execution.steps}
            onFinish={() => setConfirmOpen(true)}
            minStepSeconds={MIN_STEP_SECONDS}
            mode="ejecucion"
            initialStepPosition={execution.resumeStepPosition ?? 1}
            onStepChange={handleStepChange}
          />
        </div>
      </div>

      <OrderCancelDialog
        orderId={execution.orderId}
        stepPosition={stepPosition}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />

      <form ref={formRef} action={formAction} data-testid={ORDER_EXECUTION_FINISH_FORM_TESTID}>
        <input
          type="hidden"
          name={ORDER_EXECUTION_ORDER_ID_FIELD}
          defaultValue={execution.orderId}
        />
        <input
          type="hidden"
          name={ORDER_EXECUTION_STEP_POSITION_FIELD}
          value={stepPosition ?? ''}
        />
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => formRef.current?.requestSubmit()}
        texts={{
          title: ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.title,
          description: ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.description,
          dismiss: ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.cancel,
          confirm: ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.confirm,
        }}
        testIds={{
          dialog: ORDER_EXECUTION_FINISH_DIALOG_TESTID,
          dismiss: `${ORDER_EXECUTION_FINISH_DIALOG_TESTID}-cancel`,
          confirm: ORDER_EXECUTION_FINISH_CONFIRM_TESTID,
        }}
      />

    </OperatorScreenFrame>
  );
}
