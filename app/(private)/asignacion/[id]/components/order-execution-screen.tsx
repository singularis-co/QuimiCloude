'use client';

import { useActionState, useCallback, useRef, useState } from 'react';

import { BanIcon, FlaskConicalIcon, PlayIcon, WrenchIcon } from 'lucide-react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { RowActionsMenu } from '@/components/shared/row-actions-menu';
import { StatusBadge } from '@/components/shared/status-badge';
import { EvidenceMissingDialog, STEP_EVIDENCE_TEXTS } from '@/components/shared/step-evidence';
import { StepReader } from '@/components/shared/step-reader';
import { clampStepPosition } from '@/components/shared/step-reader/step-reader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { StartedOrderExecution } from '@/lib/modules/asignaciones';
import {
  finishAssignedOrderAction,
  recordStepMoveAction,
  startAssignedOrderAction,
  type FinishAssignedOrderResult,
  type StartAssignedOrderResult,
} from '@/lib/modules/asignaciones/adapters/driving/order-execution-actions';
import { ASSIGNED_ORDERS_ROUTE } from '@/lib/shared/routes';
import { exactDecimalTitle, formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import { OperatorScreenFrame } from '../../components/operator-screen-frame';
import { useOperatorSidePanels, type OperatorSection } from '../../components/operator-side-panels';
import { useStepEvidence } from '../../components/use-step-evidence';

import { ORDER_CANCEL_TEXTS, ORDER_CANCEL_TRIGGER_TESTID, OrderCancelDialog } from './order-cancel-dialog';
import { OrderExecutionLines } from './order-execution-lines';
import { OrderExecutionTools } from './order-execution-tools';

/**
 * El recorrido completo de la pantalla: monta `StepReader` por props y termina en
 * Finalizar. No hay ningun control de edicion: la receta, sus pasos y sus
 * lineas se leen tal cual llegaron.
 *
 * Como en empaque, entrar es libre. Un pedido `PENDIENTE` pinta la receta sin el paso a paso, la
 * vuelta habilitada y en el pie «Comenzar la fabricación», que pide confirmacion. Al confirmar,
 * `startAssignedOrderAction` lo deja `EN_CURSO` y devuelve la ejecucion comenzada: la pantalla la
 * pinta sin recargar la ruta, monta `StepReader` y cambia la vuelta por «Fabricando» hasta terminar.
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
export const ORDER_EXECUTION_STATUS_TESTID = 'order-execution-status';
export const ORDER_EXECUTION_FINISH_DIALOG_TESTID = 'order-execution-finish-dialog';
export const ORDER_EXECUTION_FINISH_CONFIRM_TESTID = 'order-execution-finish-confirm';
export const ORDER_EXECUTION_BACK_LINK_TESTID = 'order-execution-back-link';
export const ORDER_EXECUTION_START_FORM_TESTID = 'order-execution-start-form';
export const ORDER_EXECUTION_START_BUTTON_TESTID = 'order-execution-start-button';
export const ORDER_EXECUTION_START_DIALOG_TESTID = 'order-execution-start-dialog';
export const ORDER_EXECUTION_START_CONFIRM_TESTID = 'order-execution-start-confirm';
export const ORDER_EXECUTION_START_ERROR_TESTID = 'order-execution-start-error';
export const ORDER_EXECUTION_NOT_STARTED_TESTID = 'order-execution-not-started';
/** La columna lateral con las secciones. */
export const ORDER_EXECUTION_MATERIALS_TESTID = 'order-execution-materials';
export const ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS = {
  card: 'order-execution-materials-panel',
  trigger: 'order-execution-materials-panel-trigger',
  count: 'order-execution-materials-panel-count',
  content: 'order-execution-materials-panel-content',
  fab: 'order-execution-materials-fab',
} as const;
export const ORDER_EXECUTION_TOOLS_SECTION_TESTIDS = {
  card: 'order-execution-tools-panel',
  trigger: 'order-execution-tools-panel-trigger',
  count: 'order-execution-tools-panel-count',
  content: 'order-execution-tools-panel-content',
  fab: 'order-execution-tools-fab',
} as const;

/** Funcion y no literal, para que un test no pueda comparar contra una copia del texto. */
export function assignedOrderStartConfirmTexts() {
  return {
    title: '¿Comenzar el pedido?',
    description:
      'Una vez comenzado, el pedido no se puede devolver: tendrás que continuarlo hasta terminarlo.',
    cancel: 'Cancelar',
    confirm: 'Comenzar',
  } as const;
}

export const ORDER_EXECUTION_FINISH_CONFIRM_TEXTS = {
  title: '¿Terminar el pedido?',
  description: 'Terminar el pedido no se puede deshacer.',
  cancel: 'Cancelar',
  confirm: 'Terminar',
} as const;

export const ORDER_EXECUTION_TEXTS = {
  phase: 'Fabricación',
  running: 'Fabricando',
  recipeMissing: 'Esta receta está dada de baja.',
  orderQuantity: 'Cantidad',
  actions: (numberText: string) => `Acciones del pedido ${numberText}`,
  back: 'Volver a mis pedidos asignados',
  start: 'Comenzar la fabricación',
  startPending: 'Comenzando…',
  finish: 'Terminar la fabricación',
  startTitle: 'Revisa antes de comenzar',
  startBody:
    'Al pulsar «Comenzar» el pedido queda en fabricación a tu nombre y no podrás salir de esta pantalla hasta terminarlo.',
  stepCount: (count: number) => (count === 1 ? '1 paso' : `${count} pasos`),
  materials: 'Materiales',
  tools: 'Herramientas',
} as const;

const MIN_STEP_SECONDS = 5;

type FinishFormState = { readonly status: 'idle' } | FinishAssignedOrderResult;

const INITIAL_STATE: FinishFormState = { status: 'idle' };

type StartFormState = { readonly status: 'idle' } | StartAssignedOrderResult;

const START_INITIAL_STATE: StartFormState = { status: 'idle' };
/** `finishAssignedOrderAction` ignora su primer parametro (ver su propia firma): cualquier valor
 *  del tipo que espera sirve para adaptar el estado local, que ademas admite `'idle'`. */
const IGNORED_PREV_STATE: FinishAssignedOrderResult = { status: 'success' };

type StepChange = { readonly direction: 'advance' | 'go_back'; readonly position: number };

export type OrderExecutionScreenProps = {
  /** La de la pagina: `PENDIENTE` sin comenzar o `EN_CURSO` retomado. */
  readonly execution: StartedOrderExecution;
};

export function OrderExecutionScreen({ execution: opened }: OrderExecutionScreenProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const startFormRef = useRef<HTMLFormElement>(null);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [startState, startFormAction, startPending] = useActionState<StartFormState, FormData>(
    () => startAssignedOrderAction(opened.orderId),
    START_INITIAL_STATE,
  );
  // Comenzado aqui, la ejecucion es la que devolvio la accion; si no, la que abrio la pagina.
  const execution = startState.status === 'success' ? startState.data : opened;
  const started = execution.status === 'EN_CURSO';
  const startError = startState.status === 'error' ? startState : undefined;
  const startTexts = assignedOrderStartConfirmTexts();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingPositions, setMissingPositions] = useState<readonly number[]>([]);
  const [stepRequest, setStepRequest] = useState<{ position: number; id: number }>();
  const [movedStepPosition, setStepPosition] = useState<number | null>();
  // Hasta el primer cambio de paso, el de entrada; antes de comenzar no hay paso.
  const enteredStepPosition = clampStepPosition(execution.resumeStepPosition, execution.steps.length);
  const stepPosition = started ? (movedStepPosition ?? enteredStepPosition) : null;
  // Encadenadas para que lleguen en el orden de los clics; un fallo se pierde sin avisar.
  const stepMoves = useRef<Promise<void>>(Promise.resolve());
  const [state, formAction] = useActionState<FinishFormState, FormData>(
    (_previous, formData) => finishAssignedOrderAction(IGNORED_PREV_STATE, formData),
    INITIAL_STATE,
  );

  const error = state.status === 'error' ? state : undefined;
  // En estado y no en las filas: la columna y el panel pintan cada uno su copia de los materiales.
  const [selectedUnitIds, setSelectedUnitIds] = useState<ReadonlyMap<number, string>>(
    () => new Map(),
  );
  const selectUnit = useCallback((index: number, unitId: string) => {
    setSelectedUnitIds((previous) => new Map(previous).set(index, unitId));
  }, []);
  // Los portales de `StepReader` necesitan los nodos, y el primer render llega sin ellos.
  const [progressSlot, setProgressSlot] = useState<HTMLDivElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  const evidence = useStepEvidence({
    orderId: execution.orderId,
    phase: 'manufacturing',
    steps: execution.steps,
    initial: execution.evidence,
  });

  function handleFinish() {
    const missing = evidence.missingPositions();
    if (missing.length > 0) {
      setMissingPositions(missing);
      setMissingOpen(true);
      return;
    }
    setConfirmOpen(true);
  }

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

  const sections: OperatorSection[] = [
    {
      key: 'materials',
      title: ORDER_EXECUTION_TEXTS.materials,
      icon: FlaskConicalIcon,
      count: execution.lines.length,
      content: (
        <OrderExecutionLines
          lines={execution.lines}
          selectedUnitIds={selectedUnitIds}
          onSelectUnit={selectUnit}
        />
      ),
      testIds: ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS,
    },
  ];
  if (execution.tools.length > 0) {
    sections.push({
      key: 'tools',
      title: ORDER_EXECUTION_TEXTS.tools,
      icon: WrenchIcon,
      count: execution.tools.length,
      content: <OrderExecutionTools tools={execution.tools} label={ORDER_EXECUTION_TEXTS.tools} />,
      testIds: ORDER_EXECUTION_TOOLS_SECTION_TESTIDS,
    });
  }
  const sidePanels = useOperatorSidePanels({
    sections,
    columnTestId: ORDER_EXECUTION_MATERIALS_TESTID,
  });

  const startFooter = started ? undefined : (
    <div className="mx-auto w-full max-w-[360px]">
      <form
        ref={startFormRef}
        action={startFormAction}
        data-testid={ORDER_EXECUTION_START_FORM_TESTID}
        className="flex"
      >
        <Button
          type="button"
          size="xl"
          touch
          className="w-full"
          onClick={() => setStartConfirmOpen(true)}
          disabled={startPending}
          aria-busy={startPending}
          data-testid={ORDER_EXECUTION_START_BUTTON_TESTID}
        >
          <PlayIcon aria-hidden="true" />
          {startPending ? ORDER_EXECUTION_TEXTS.startPending : ORDER_EXECUTION_TEXTS.start}
        </Button>
        <ConfirmDialog
          open={startConfirmOpen}
          onOpenChange={setStartConfirmOpen}
          onConfirm={() => startFormRef.current?.requestSubmit()}
          texts={{
            title: startTexts.title,
            description: startTexts.description,
            dismiss: startTexts.cancel,
            confirm: startTexts.confirm,
          }}
          testIds={{
            dialog: ORDER_EXECUTION_START_DIALOG_TESTID,
            dismiss: `${ORDER_EXECUTION_START_DIALOG_TESTID}-cancel`,
            confirm: ORDER_EXECUTION_START_CONFIRM_TESTID,
          }}
        />
      </form>
    </div>
  );

  return (
    <OperatorScreenFrame
      testId={ORDER_EXECUTION_SCREEN_TESTID}
      // Comenzado no hay vuelta: el pedido ya no se puede devolver.
      back={
        started
          ? undefined
          : {
              href: ASSIGNED_ORDERS_ROUTE,
              label: ORDER_EXECUTION_TEXTS.back,
              testId: ORDER_EXECUTION_BACK_LINK_TESTID,
            }
      }
      running={started ? ORDER_EXECUTION_TEXTS.running : undefined}
      footer={startFooter}
      footerSlotRef={started ? setActionsSlot : undefined}
      progressSlotRef={started ? setProgressSlot : undefined}
      overlay={sidePanels.overlay}
      phaseLabel={ORDER_EXECUTION_TEXTS.phase}
      eyebrow={execution.numberText}
      title={execution.recipeName ?? ORDER_EXECUTION_TEXTS.recipeMissing}
      titleTestId={ORDER_EXECUTION_TITLE_TESTID}
      quantity={
        <span
          data-testid={ORDER_EXECUTION_ORDER_QUANTITY_TESTID}
          title={exactDecimalTitle(execution.orderQuantity)}
          className="inline-flex min-h-9 items-center gap-2 rounded-full bg-muted px-3 text-sm"
        >
          <span className="text-muted-foreground">{ORDER_EXECUTION_TEXTS.orderQuantity}</span>{' '}
          <span className="font-mono font-semibold tabular-nums">
            {formatDecimalDisplay(execution.orderQuantity)}
            {execution.unitLabel === null ? null : ` ${execution.unitLabel}`}
          </span>
        </span>
      }
      status={
        <StatusBadge
          tone={ORDER_STATUS_TONES[execution.status]}
          label={ORDER_STATUS_LABELS[execution.status]}
          data-testid={ORDER_EXECUTION_STATUS_TESTID}
          data-status={execution.status}
        />
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
      <div className="grid grid-cols-1 items-start gap-5 @min-[1001px]:grid-cols-[320px_minmax(0,1fr)] @min-[1001px]:gap-x-6">
        {sidePanels.column}

        <div className="flex min-w-0 flex-col gap-4">
          {startError !== undefined ? (
            <ErrorAlert
              error={startError}
              testId={ORDER_EXECUTION_START_ERROR_TESTID}
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            />
          ) : null}
          {error !== undefined ? (
            <ErrorAlert
              error={error}
              testId={ORDER_EXECUTION_FINISH_ERROR_TESTID}
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            />
          ) : null}
          {/* Sin comenzar no hay paso a paso: se monta al comenzar, en su paso de entrada. */}
          {started ? (
            <StepReader
              steps={execution.steps}
              onFinish={handleFinish}
              minStepSeconds={MIN_STEP_SECONDS}
              mode="ejecucion"
              initialStepPosition={execution.resumeStepPosition ?? 1}
              onStepChange={handleStepChange}
              renderStepAddon={evidence.renderStepAddon}
              stepBlockReason={evidence.stepBlockReason}
              stepRequest={stepRequest}
              finishLabel={ORDER_EXECUTION_TEXTS.finish}
              slots={{ progress: progressSlot, actions: actionsSlot }}
            />
          ) : (
            <Card
              data-testid={ORDER_EXECUTION_NOT_STARTED_TESTID}
              className="items-start gap-3 rounded-2xl border border-dashed border-input p-6 ring-0"
            >
              <h3 className="m-0 text-lg font-semibold">{ORDER_EXECUTION_TEXTS.startTitle}</h3>
              <p className="m-0 text-base text-muted-foreground">{ORDER_EXECUTION_TEXTS.startBody}</p>
              <p className="m-0 text-[15px] font-semibold">
                {ORDER_EXECUTION_TEXTS.stepCount(execution.steps.length)}
              </p>
            </Card>
          )}
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
          description: evidence.hasEvidenceSteps
            ? STEP_EVIDENCE_TEXTS.finishWarning
            : ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.description,
          dismiss: ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.cancel,
          confirm: ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.confirm,
        }}
        testIds={{
          dialog: ORDER_EXECUTION_FINISH_DIALOG_TESTID,
          dismiss: `${ORDER_EXECUTION_FINISH_DIALOG_TESTID}-cancel`,
          confirm: ORDER_EXECUTION_FINISH_CONFIRM_TESTID,
        }}
      />

      <EvidenceMissingDialog
        open={missingOpen}
        onOpenChange={setMissingOpen}
        positions={missingPositions}
        onGoToStep={(position) =>
          setStepRequest((previous) => ({ position, id: (previous?.id ?? 0) + 1 }))
        }
      />
    </OperatorScreenFrame>
  );
}
