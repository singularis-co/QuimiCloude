'use client';

import { CheckIcon, PlayIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';

import {
  OperatorScreenFrame,
  STEP_READER_SIDE_COLUMN_RESERVE,
} from '../../../components/operator-screen-frame';
import { useStepEvidence } from '../../../components/use-step-evidence';
import { PackingFinishDialog, type PackingFinishSubmission } from './packing-finish-dialog';

/**
 * La pantalla de un pedido de empaque, sobre el marco del operario. Sin control de edicion: los
 * datos del pedido se leen tal cual llegaron por props. Se compara SIEMPRE `packedById` con el
 * actor, nunca por nombre, porque dos usuarios pueden llamarse igual. El pie pinta siempre
 * «Comenzar» y «Terminar», y solo uno queda habilitado:
 *
 *   1. `POR_EMPACAR` -> **Comenzar**.
 *   2. `EN_EMPAQUE` a nombre del propio actor -> **Terminar**; si hay pasos de envasado, el pie es
 *      el del paso a paso y su ultimo boton abre la misma confirmacion.
 *   3. `EN_EMPAQUE` a nombre de otro -> los dos deshabilitados y un aviso con quien empaca.
 *   4. `EN_EMPAQUE` propio sin `finish` (el pedido no tiene unidad) -> Terminar deshabilitado, en el
 *      pie o en el ultimo paso, y un aviso que lo explica: sin unidad no hay con que validar el conteo.
 *
 * El boton que no aplica se pinta deshabilitado y SIN `data-testid`: el testid sigue marcando
 * solo el boton que abre su confirmacion, dentro de su `<form>`, como antes.
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
  recipeMissing: 'Esta receta está dada de baja.',
  quantity: 'Cantidad:',
  distribution: 'Reparto',
  emptyDistribution: 'Sin presentación',
  missingDistribution: 'Falta el reparto: lo define quien edita pedidos',
  start: 'Comenzar',
  startPending: 'Comenzando…',
  finish: 'Terminar',
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
      className="flex"
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
  ) : (
    <Button type="button" size="xl" touch variant="outline" className={FOOTER_BUTTON_CLASS} disabled>
      {startIcon}
      {PACKING_ORDER_TEXTS.start}
    </Button>
  );

  const finishCell =
    canFinish && !showsPackingSteps && !lacksUnit ? (
      <form
        ref={finishFormRef}
        action={finishFormAction}
        data-testid={PACKING_ORDER_FINISH_FORM_TESTID}
        className="flex"
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
    ) : (
      <Button
        type="button"
        size="xl"
        touch
        variant="outline"
        className={FOOTER_BUTTON_CLASS}
        disabled
        aria-describedby={lacksUnit ? missingUnitId : undefined}
      >
        {finishIcon}
        {PACKING_ORDER_TEXTS.finish}
      </Button>
    );

  // Con paso a paso el pie es el de `StepReader`: el marco no pinta el suyo.
  const footer = showsPackingSteps ? undefined : (
    <div className="grid grid-cols-1 gap-x-6 @min-[1101px]:grid-cols-[300px_minmax(0,720px)] @min-[1101px]:justify-center">
      <div aria-hidden="true" className="hidden @min-[1101px]:block" />
      <div className="grid grid-cols-2 gap-3">
        {startCell}
        {finishCell}
      </div>
    </div>
  );

  return (
    <OperatorScreenFrame
      testId={PACKING_ORDER_SCREEN_TESTID}
      back={{ href: backHref, label: PACKING_ORDER_TEXTS.back, testId: PACKING_ORDER_BACK_LINK_TESTID }}
      eyebrow={order.numberText}
      title={order.recipeName ?? PACKING_ORDER_TEXTS.recipeMissing}
      titleTestId={PACKING_ORDER_RECIPE_TESTID}
      status={
        <StatusBadge
          tone={ORDER_STATUS_TONES[order.status]}
          label={ORDER_STATUS_LABELS[order.status]}
          data-testid={PACKING_ORDER_STATUS_TESTID}
          data-status={order.status}
        />
      }
      footer={footer}
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

      <div className="grid grid-cols-1 items-start gap-5 @min-[1101px]:grid-cols-[300px_minmax(0,720px)] @min-[1101px]:justify-center @min-[1101px]:gap-x-6">
        <Card className={cn('gap-4 p-4', showsPackingSteps && STEP_READER_SIDE_COLUMN_RESERVE)}>
          <p
            className="text-base font-medium"
            data-testid={PACKING_ORDER_QUANTITY_TESTID}
            title={exactDecimalTitle(order.quantity)}
          >
            {PACKING_ORDER_TEXTS.quantity} {formatDecimalDisplay(order.quantity)}
            {order.unitLabel === null ? null : ` ${order.unitLabel}`}
          </p>

          <section
            aria-labelledby="packing-order-distribution-heading"
            className="flex flex-col gap-2"
            data-testid={PACKING_ORDER_PRESENTATION_TESTID}
          >
            <h2 id="packing-order-distribution-heading" className="text-base font-semibold">
              {PACKING_ORDER_TEXTS.distribution}
            </h2>
            {order.presentationLines.length === 0 ? (
              <p className="text-base text-muted-foreground">
                {PACKING_ORDER_TEXTS.emptyDistribution}
              </p>
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
          </section>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Encima del contenido y no al final: el pie fijo taparía lo último. */}
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
