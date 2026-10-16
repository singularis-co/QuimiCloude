'use client';

import { CheckIcon, PackageIcon, PlayIcon } from 'lucide-react';
import { useActionState, useId, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EntityImage } from '@/components/shared/entity-image';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Notice } from '@/components/shared/notice';
import { orderDistributionLineText } from '@/components/shared/order-distribution-label';
import { StatusBadge } from '@/components/shared/status-badge';
import { EvidenceMissingDialog } from '@/components/shared/step-evidence';
import { StepReader } from '@/components/shared/step-reader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { PackingOrderDetail, PackingOrderRow } from '@/lib/modules/asignaciones';
import {
  finishPackingAction,
  startPackingAction,
  type FinishPackingResult,
  type StartPackingResult,
} from '@/lib/modules/asignaciones/adapters/driving/order-packing-actions';
import { exactDecimalTitle, formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import { OperatorScreenFrame } from '../../../components/operator-screen-frame';
import { useOperatorSidePanels } from '../../../components/operator-side-panels';
import { useStepEvidence } from '../../../components/use-step-evidence';
import { PackingFinishDialog, type PackingFinishSubmission } from './packing-finish-dialog';

/**
 * La pantalla de un pedido de empaque, sobre el marco del operario. Se compara SIEMPRE
 * `packedById` con el actor, nunca por nombre, porque dos usuarios pueden llamarse igual. El pie
 * pinta solo lo que aplica:
 *
 *   1. `POR_EMPACAR` -> «Comenzar el empaque».
 *   2. `EN_EMPAQUE` propio -> «Terminar el empaque»; con pasos de envasado, el pie es el del paso a
 *      paso y su ultimo boton abre la misma confirmacion.
 *   3. `EN_EMPAQUE` a nombre de otro -> ningun boton, solo quien empaca.
 *   4. `EN_EMPAQUE` propio sin `finish` (el pedido no tiene unidad) -> terminar deshabilitado y un
 *      aviso que lo explica: sin unidad no hay con que validar el conteo.
 *
 * `startPackingAction` vuelve a la MISMA pantalla (revalida su ruta); `finishPackingAction`
 * termina, en el servidor, con una redireccion a «Por empacar» -su camino feliz nunca resuelve
 * aqui-.
 */

export const PACKING_ORDER_SCREEN_TESTID = 'packing-order-screen';
export const PACKING_ORDER_RECIPE_TESTID = 'packing-order-recipe';
export const PACKING_ORDER_QUANTITY_TESTID = 'packing-order-quantity';
export const PACKING_ORDER_PRESENTATION_TESTID = 'packing-order-presentation';
export const PACKING_ORDER_PRESENTATION_LINE_TESTID = 'packing-order-presentation-line';
export const PACKING_ORDER_MISSING_DISTRIBUTION_TESTID = 'packing-order-missing-distribution';
export const PACKING_ORDER_STATUS_TESTID = 'packing-order-status';
export const PACKING_ORDER_PACKER_TESTID = 'packing-order-packer';
export const PACKING_ORDER_START_FORM_TESTID = 'packing-order-start-form';
export const PACKING_ORDER_START_BUTTON_TESTID = 'packing-order-start-button';
export const PACKING_ORDER_FINISH_FORM_TESTID = 'packing-order-finish-form';
export const PACKING_ORDER_FINISH_BUTTON_TESTID = 'packing-order-finish-button';
export const PACKING_ORDER_START_ERROR_TESTID = 'packing-order-start-error';
export const PACKING_ORDER_FINISH_ERROR_TESTID = 'packing-order-finish-error';
export const PACKING_ORDER_BACK_LINK_TESTID = 'packing-order-back-link';
export const PACKING_ORDER_STEPS_TESTID = 'packing-order-steps';
export const PACKING_ORDER_MISSING_UNIT_TESTID = 'packing-order-missing-unit';
export const PACKING_ORDER_FOOTER_REASON_TESTID = 'packing-order-footer-reason';
export const PACKING_ORDER_NOT_STARTED_TESTID = 'packing-order-not-started';
export const PACKING_ORDER_SECTIONS_TESTID = 'packing-order-sections';
export const PACKING_ORDER_PACKAGES_TESTIDS = {
  card: 'packing-order-packages-card',
  trigger: 'packing-order-packages-trigger',
  count: 'packing-order-packages-count',
  content: 'packing-order-packages-content',
  fab: 'packing-order-packages-fab',
} as const;
export const PACKING_ORDER_ID_FIELD = 'orderId';
export const PACKING_ORDER_LINES_FIELD = 'lines';
export const PACKING_ORDER_START_DIALOG_TESTID = 'packing-order-start-dialog';
export const PACKING_ORDER_START_CONFIRM_TESTID = 'packing-order-start-confirm';
export const PACKING_ORDER_FINISH_DIALOG_TESTID = 'packing-order-finish-dialog';
export const PACKING_ORDER_FINISH_CONFIRM_TESTID = 'packing-order-finish-confirm';

export const PACKING_ORDER_START_CONFIRM_TEXTS = {
  title: '¿Comenzar el empaque?',
  description:
    'Una vez comenzado, el empaque no se puede devolver: tendrás que continuarlo hasta terminarlo.',
  cancel: 'Cancelar',
  confirm: 'Comenzar',
} as const;

export const PACKING_ORDER_TEXTS = {
  back: 'Volver a «Por empacar»',
  phase: 'Empaque',
  running: 'Empacando',
  recipeMissing: 'Esta receta está dada de baja.',
  quantity: 'Cantidad',
  packages: 'Envases',
  emptyDistribution: 'Sin presentación',
  missingDistribution: 'Falta el reparto: lo define quien edita pedidos',
  startTitle: 'Revisa antes de comenzar',
  startBody: 'Al comenzar, el empaque queda a tu nombre. Al terminar indicas los envases reales.',
  start: 'Comenzar el empaque',
  startPending: 'Comenzando…',
  finish: 'Terminar el empaque',
  finishPending: 'Terminando…',
  packingSteps: 'Pasos de envasado',
  packerUnknown: 'Lo está empacando otra persona.',
  packer: (name: string) => `Lo está empacando ${name}.`,
  missingUnit: 'Falta la unidad del pedido: sin ella no se puede comprobar el conteo real.',
} as const;

const START_DIALOG_TEXTS = {
  title: PACKING_ORDER_START_CONFIRM_TEXTS.title,
  description: PACKING_ORDER_START_CONFIRM_TEXTS.description,
  dismiss: PACKING_ORDER_START_CONFIRM_TEXTS.cancel,
  confirm: PACKING_ORDER_START_CONFIRM_TEXTS.confirm,
};

const PACKING_MIN_STEP_SECONDS = 5;

function packerLabel(order: PackingOrderRow): string {
  return order.packedByName === null
    ? PACKING_ORDER_TEXTS.packerUnknown
    : PACKING_ORDER_TEXTS.packer(order.packedByName);
}

const START_INITIAL_STATE: StartPackingResult = { status: 'success' };
const FINISH_INITIAL_STATE: FinishPackingResult = { status: 'success' };

const FOOTER_ONE_BUTTON_CLASS = 'mx-auto flex w-full max-w-[360px]';
const FOOTER_BUTTON_CLASS = 'w-full';

export type PackingOrderScreenProps = {
  readonly order: PackingOrderDetail;
  /** El id del actor de la sesion, nunca su nombre: se decide comparando `packedById`. */
  readonly actorId: string;
  readonly backHref: string;
};

export function PackingOrderScreen({ order, actorId, backHref }: PackingOrderScreenProps) {
  const startFormRef = useRef<HTMLFormElement>(null);
  const finishFormRef = useRef<HTMLFormElement>(null);
  const finishLinesRef = useRef<HTMLInputElement>(null);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingPositions, setMissingPositions] = useState<readonly number[]>([]);
  const [stepRequest, setStepRequest] = useState<{ position: number; id: number }>();

  const [startState, startFormAction, startPending] = useActionState<
    StartPackingResult,
    FormData
  >((_previous, formData) => startPackingAction(START_INITIAL_STATE, formData), START_INITIAL_STATE);

  const [finishState, finishFormAction, finishPending] = useActionState<
    FinishPackingResult,
    FormData
  >((_previous, formData) => finishPackingAction(FINISH_INITIAL_STATE, formData), FINISH_INITIAL_STATE);

  const startError = startState.status === 'error' ? startState : undefined;
  const finishError = finishState.status === 'error' ? finishState : undefined;

  const canStart = order.status === 'POR_EMPACAR';
  const canFinish = order.status === 'EN_EMPAQUE' && order.packedById === actorId;
  const showsOtherPacker = order.status === 'EN_EMPAQUE' && order.packedById !== actorId;
  const lacksDistribution = order.status === 'POR_EMPACAR' && order.presentationLines.length === 0;
  const showsPackingSteps = canFinish && order.packingSteps.length > 0;
  const lacksUnit = canFinish && order.finish === null;
  const missingUnitId = useId();
  // En estado y no en ref: `StepReader` necesita re-renderizar cuando el marco ya pintó los nodos.
  const [progressNode, setProgressNode] = useState<HTMLDivElement | null>(null);
  const [footerNode, setFooterNode] = useState<HTMLDivElement | null>(null);

  const evidence = useStepEvidence({
    orderId: order.id,
    phase: 'packing',
    steps: order.packingSteps,
    initial: order.packingEvidence,
  });

  function stepBlockReason(position: number): string | null {
    const reason = evidence.stepBlockReason(position);
    if (reason !== null || !lacksUnit || position !== order.packingSteps.length) return reason;
    return PACKING_ORDER_TEXTS.missingUnit;
  }

  function handleStepsFinish() {
    const missing = evidence.missingPositions();
    if (missing.length > 0) {
      setMissingPositions(missing);
      setMissingOpen(true);
      return;
    }
    setFinishConfirmOpen(true);
  }

  // El diálogo vive en un portal, fuera del `<form>`: el conteo entra por el campo oculto.
  function submitFinish(lines: PackingFinishSubmission) {
    if (finishLinesRef.current !== null) finishLinesRef.current.value = JSON.stringify(lines);
    finishFormRef.current?.requestSubmit();
  }

  const quantityText = `${formatDecimalDisplay(order.quantity)}${order.unitLabel === null ? '' : ` ${order.unitLabel}`}`;

  const startDialog = (
    <ConfirmDialog
      open={startConfirmOpen}
      onOpenChange={setStartConfirmOpen}
      onConfirm={() => startFormRef.current?.requestSubmit()}
      texts={START_DIALOG_TEXTS}
      testIds={{
        dialog: PACKING_ORDER_START_DIALOG_TESTID,
        dismiss: `${PACKING_ORDER_START_DIALOG_TESTID}-cancel`,
        confirm: PACKING_ORDER_START_CONFIRM_TESTID,
      }}
    />
  );

  const finishDialog = (
    <PackingFinishDialog
      open={finishConfirmOpen}
      onOpenChange={setFinishConfirmOpen}
      finish={order.finish}
      numberText={order.numberText}
      recipeName={order.recipeName ?? PACKING_ORDER_TEXTS.recipeMissing}
      quantityText={quantityText}
      hasEvidenceSteps={evidence.hasEvidenceSteps}
      onConfirm={submitFinish}
      testIds={{
        dialog: PACKING_ORDER_FINISH_DIALOG_TESTID,
        dismiss: `${PACKING_ORDER_FINISH_DIALOG_TESTID}-cancel`,
        confirm: PACKING_ORDER_FINISH_CONFIRM_TESTID,
      }}
    />
  );

  const startIcon = <PlayIcon aria-hidden="true" />;
  const finishIcon = <CheckIcon aria-hidden="true" />;

  const startCell = canStart ? (
    <form
      ref={startFormRef}
      action={startFormAction}
      data-testid={PACKING_ORDER_START_FORM_TESTID}
      className={FOOTER_ONE_BUTTON_CLASS}
    >
      <input type="hidden" name={PACKING_ORDER_ID_FIELD} defaultValue={order.id} />
      <Button
        type="button"
        size="xl"
        touch
        className={FOOTER_BUTTON_CLASS}
        onClick={() => setStartConfirmOpen(true)}
        disabled={startPending}
        aria-busy={startPending}
        data-testid={PACKING_ORDER_START_BUTTON_TESTID}
      >
        {startIcon}
        {startPending ? PACKING_ORDER_TEXTS.startPending : PACKING_ORDER_TEXTS.start}
      </Button>
      {startDialog}
    </form>
  ) : null;

  const finishCell = !canFinish || showsPackingSteps ? null : lacksUnit ? (
    <div className={FOOTER_ONE_BUTTON_CLASS}>
      <Button
        type="button"
        size="xl"
        touch
        className={FOOTER_BUTTON_CLASS}
        disabled
        aria-describedby={missingUnitId}
      >
        {finishIcon}
        {PACKING_ORDER_TEXTS.finish}
      </Button>
    </div>
  ) : (
    <form
      ref={finishFormRef}
      action={finishFormAction}
      data-testid={PACKING_ORDER_FINISH_FORM_TESTID}
      className={FOOTER_ONE_BUTTON_CLASS}
    >
      <input type="hidden" name={PACKING_ORDER_ID_FIELD} defaultValue={order.id} />
      <input ref={finishLinesRef} type="hidden" name={PACKING_ORDER_LINES_FIELD} defaultValue="" />
      <Button
        type="button"
        size="xl"
        touch
        className={FOOTER_BUTTON_CLASS}
        onClick={() => setFinishConfirmOpen(true)}
        disabled={finishPending}
        aria-busy={finishPending}
        data-testid={PACKING_ORDER_FINISH_BUTTON_TESTID}
      >
        {finishIcon}
        {finishPending ? PACKING_ORDER_TEXTS.finishPending : PACKING_ORDER_TEXTS.finish}
      </Button>
      {finishDialog}
    </form>
  );

  // Con paso a paso, el pie lo pinta `StepReader` por portal en `footerNode`.
  const footer = showsOtherPacker ? (
    <p
      role="status"
      className="py-3 text-center text-base text-muted-foreground"
      data-testid={PACKING_ORDER_FOOTER_REASON_TESTID}
    >
      {packerLabel(order)}
    </p>
  ) : (startCell ?? finishCell ?? undefined);

  const packagesContent = (
    <div className="flex flex-col gap-2" data-testid={PACKING_ORDER_PRESENTATION_TESTID}>
      {order.presentationLines.length === 0 ? (
        <p className="text-base text-muted-foreground">{PACKING_ORDER_TEXTS.emptyDistribution}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {order.presentationLines.map((line) => (
            <li
              key={line.presentationId}
              className="flex items-center gap-3 text-base"
              data-testid={PACKING_ORDER_PRESENTATION_LINE_TESTID}
            >
              <EntityImage
                path={line.packagingImageUrl ?? null}
                name={line.packagingName ?? line.presentationName ?? ''}
              />
              <span className="min-w-0">{orderDistributionLineText(line)}</span>
            </li>
          ))}
        </ul>
      )}
      {lacksDistribution ? (
        <Notice tone="warning" testId={PACKING_ORDER_MISSING_DISTRIBUTION_TESTID}>
          {PACKING_ORDER_TEXTS.missingDistribution}
        </Notice>
      ) : null}
    </div>
  );

  const sidePanels = useOperatorSidePanels({
    columnTestId: PACKING_ORDER_SECTIONS_TESTID,
    sections: [
      {
        key: 'materials',
        title: PACKING_ORDER_TEXTS.packages,
        icon: PackageIcon,
        count: order.presentationLines.length,
        content: packagesContent,
        testIds: PACKING_ORDER_PACKAGES_TESTIDS,
      },
    ],
  });

  return (
    <OperatorScreenFrame
      testId={PACKING_ORDER_SCREEN_TESTID}
      back={{
        href: backHref,
        label: PACKING_ORDER_TEXTS.back,
        testId: PACKING_ORDER_BACK_LINK_TESTID,
      }}
      running={canFinish ? PACKING_ORDER_TEXTS.running : undefined}
      phaseLabel={PACKING_ORDER_TEXTS.phase}
      eyebrow={order.numberText}
      title={order.recipeName ?? PACKING_ORDER_TEXTS.recipeMissing}
      titleTestId={PACKING_ORDER_RECIPE_TESTID}
      quantity={
        <span
          className="inline-flex min-h-9 items-center gap-2 rounded-full bg-muted px-3 text-sm"
          data-testid={PACKING_ORDER_QUANTITY_TESTID}
          title={exactDecimalTitle(order.quantity)}
        >
          <span className="text-muted-foreground">{PACKING_ORDER_TEXTS.quantity}</span>{' '}
          <span className="font-mono font-semibold tabular-nums">{quantityText}</span>
        </span>
      }
      status={
        <StatusBadge
          tone={ORDER_STATUS_TONES[order.status]}
          label={ORDER_STATUS_LABELS[order.status]}
          data-testid={PACKING_ORDER_STATUS_TESTID}
          data-status={order.status}
        />
      }
      progressSlotRef={showsPackingSteps ? setProgressNode : undefined}
      footer={footer}
      footerSlotRef={showsPackingSteps ? setFooterNode : undefined}
      overlay={sidePanels.overlay}
    >
      {showsOtherPacker ? (
        <Notice tone="info" testId={PACKING_ORDER_PACKER_TESTID}>
          {packerLabel(order)}
        </Notice>
      ) : null}

      {lacksUnit ? (
        <Notice tone="warning" id={missingUnitId} testId={PACKING_ORDER_MISSING_UNIT_TESTID}>
          {PACKING_ORDER_TEXTS.missingUnit}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 @min-[1001px]:grid-cols-[320px_minmax(0,1fr)] @min-[1001px]:gap-x-6">
        {sidePanels.column}

        <div className="flex min-w-0 flex-col gap-4">
          {startError !== undefined ? (
            <ErrorAlert
              error={startError}
              testId={PACKING_ORDER_START_ERROR_TESTID}
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            />
          ) : null}

          {finishError !== undefined ? (
            <ErrorAlert
              error={finishError}
              testId={PACKING_ORDER_FINISH_ERROR_TESTID}
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            />
          ) : null}

          {canFinish ? null : (
            <Card
              className="items-start gap-3 rounded-2xl border border-dashed border-input p-6 ring-0"
              data-testid={PACKING_ORDER_NOT_STARTED_TESTID}
            >
              <h3 className="text-lg font-semibold">{PACKING_ORDER_TEXTS.startTitle}</h3>
              <p className="text-base text-muted-foreground">{PACKING_ORDER_TEXTS.startBody}</p>
            </Card>
          )}

          {showsPackingSteps ? (
            <div data-testid={PACKING_ORDER_STEPS_TESTID}>
              <StepReader
                steps={order.packingSteps}
                title={PACKING_ORDER_TEXTS.packingSteps}
                onFinish={handleStepsFinish}
                minStepSeconds={PACKING_MIN_STEP_SECONDS}
                mode="ejecucion"
                finishLabel={
                  finishPending ? PACKING_ORDER_TEXTS.finishPending : PACKING_ORDER_TEXTS.finish
                }
                finishBusy={finishPending}
                renderStepAddon={evidence.renderStepAddon}
                stepBlockReason={stepBlockReason}
                stepRequest={stepRequest}
                slots={{ progress: progressNode, actions: footerNode }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {showsPackingSteps ? (
        // El último botón del paso a paso abre el diálogo; este `<form>` envía.
        <form
          ref={finishFormRef}
          action={finishFormAction}
          data-testid={PACKING_ORDER_FINISH_FORM_TESTID}
          className="hidden"
        >
          <input type="hidden" name={PACKING_ORDER_ID_FIELD} defaultValue={order.id} />
          <input ref={finishLinesRef} type="hidden" name={PACKING_ORDER_LINES_FIELD} defaultValue="" />
          {finishDialog}
        </form>
      ) : null}

      {showsPackingSteps ? (
        <EvidenceMissingDialog
          open={missingOpen}
          onOpenChange={setMissingOpen}
          positions={missingPositions}
          onGoToStep={(position) =>
            setStepRequest((previous) => ({ position, id: (previous?.id ?? 0) + 1 }))
          }
        />
      ) : null}
    </OperatorScreenFrame>
  );
}
