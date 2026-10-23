'use client';

import { useState } from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ConditioningOrderDetail, ConditioningTeamCandidates } from '@/lib/modules/asignaciones';
import type { ErrorState } from '@/lib/modules/errores';
import type { OrderStatus } from '@/lib/modules/pedidos';
import { exactDecimalTitle, formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';
import { cn } from '@/lib/utils';

// Por su archivo y no por el barrel: una pantalla de cliente no debe arrastrar secciones de servidor.
import { assignmentViewHref } from '../../../components/assignment-view-params';
import { OperatorScreenFrame, STEP_READER_SIDE_COLUMN_RESERVE } from '../../../components/operator-screen-frame';
import { OrderDistributionFull, orderDistributionFullText } from '../../../components/order-distribution-full';

import { ConditioningActions } from './conditioning-actions';
import { ConditioningBatchDataForm } from './conditioning-batch-data-form';
import { ConditioningStepsPanel, type ConditioningStepsPanelView } from './conditioning-steps-panel';
import { ConditioningTeamList } from './conditioning-team-list';

/**
 * El detalle de un pedido para quien acondiciona, sobre el marco del operario: cabecera con la
 * vuelta, el número, la receta, el reparto y el estado; en el cuerpo, las tarjetas «Equipo» y
 * «Datos de lote»; en el pie, «Acondicionar» y «Terminar». Qué acción se habilita lo decide la
 * página; la autorización real la hacen los casos de uso.
 *
 * Con pasos de acondicionamiento, el paso a paso ocupa la columna principal y su pie sustituye al
 * del marco hasta completarlos: mientras tanto «Datos de lote» queda bloqueada y «Terminar» no se
 * ofrece.
 */

export const CONDITIONING_ORDER_SCREEN_TESTID = 'conditioning-order-screen';
export const CONDITIONING_ORDER_NUMBER_TESTID = 'conditioning-order-number';
export const CONDITIONING_ORDER_RECIPE_TESTID = 'conditioning-order-recipe';
export const CONDITIONING_ORDER_QUANTITY_TESTID = 'conditioning-order-quantity';
export const CONDITIONING_ORDER_DISTRIBUTION_TESTID = 'conditioning-order-distribution';
export const CONDITIONING_ORDER_STATUS_TESTID = 'conditioning-order-status';
export const CONDITIONING_ORDER_CONDITIONER_TESTID = 'conditioning-order-conditioner';
export const CONDITIONING_ORDER_BACK_LINK_TESTID = 'conditioning-order-back-link';
export const CONDITIONING_ORDER_CANDIDATES_ERROR_TESTID = 'conditioning-order-candidates-error';
export const CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID = 'conditioning-order-batch-data-missing';

export const CONDITIONING_ORDER_SCREEN_TEXTS = {
  recipeMissing: 'Esta fórmula está dada de baja.',
  quantityLabel: 'Cantidad:',
  conditionedBy: (name: string) => `Lo acondiciona ${name}.`,
  backToQueue: 'Volver a «Por acondicionar»',
  backToConditioned: 'Volver a «Acondicionados»',
  batchDataMissing: (count: number) =>
    count === 1 ? 'Faltan los datos de lote de 1 línea.' : `Faltan los datos de lote de ${count} líneas.`,
} as const;

const BATCH_DATA_MISSING_ID = 'conditioning-order-batch-data-missing';

function backLink(status: OrderStatus): { readonly href: string; readonly label: string } {
  if (status === 'TERMINADO' || status === 'ENTREGADO') {
    return { href: assignmentViewHref('acondicionados'), label: CONDITIONING_ORDER_SCREEN_TEXTS.backToConditioned };
  }
  return { href: assignmentViewHref('por_acondicionar'), label: CONDITIONING_ORDER_SCREEN_TEXTS.backToQueue };
}

export type ConditioningOrderScreenProps = {
  readonly order: ConditioningOrderDetail;
  readonly canStart?: boolean;
  readonly canFinish?: boolean;
  /** «Terminar» se ofrece deshabilitado. */
  readonly finishBlocked?: boolean;
  /** Sin candidatos «Acondicionar» se pinta deshabilitado. */
  readonly candidates?: ConditioningTeamCandidates | null;
  readonly candidatesError?: ErrorState | null;
};

export function ConditioningOrderScreen({
  order,
  canStart = false,
  canFinish = false,
  finishBlocked = false,
  candidates = null,
  candidatesError = null,
}: ConditioningOrderScreenProps) {
  const back = backLink(order.status);
  const batchData = order.batchData;
  const missingCount = batchData?.missingCount ?? 0;
  const showMissing = missingCount > 0;

  const conditioning = order.conditioningSteps;
  // La respuesta de la acción puede llegar antes que las props nuevas de la ruta revalidada.
  const [recordedCount, setRecordedCount] = useState(0);
  const completedCount = Math.max(conditioning?.completedCount ?? 0, recordedCount);
  const stepsPending = conditioning !== null && completedCount < conditioning.steps.length;
  const [stepsView, setStepsView] = useState<ConditioningStepsPanelView>(() =>
    conditioning !== null && conditioning.completedCount >= conditioning.steps.length ? 'done' : 'steps',
  );
  const showsStepReader = conditioning !== null && (stepsView === 'steps' || stepsPending);

  const teamCard =
    order.team.length > 0 ? (
      <Card>
        <CardContent>
          <ConditioningTeamList team={order.team} />
        </CardContent>
      </Card>
    ) : null;

  const batchDataCard =
    batchData === null ? null : (
      <Card>
        <CardContent>
          <ConditioningBatchDataForm
            orderId={order.id}
            form={batchData.form}
            divergentLabels={Object.fromEntries(
              batchData.lines.map((line) => [line.presentationId, orderDistributionFullText([line])]),
            )}
            locked={stepsPending}
          />
        </CardContent>
      </Card>
    );

  const footer = (
    <div className="flex flex-col items-end gap-2">
      {showMissing ? (
        <p
          id={BATCH_DATA_MISSING_ID}
          className="text-base font-medium"
          data-testid={CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID}
        >
          {CONDITIONING_ORDER_SCREEN_TEXTS.batchDataMissing(missingCount)}
        </p>
      ) : null}
      <ConditioningActions
        orderId={order.id}
        orderNumber={order.numberText}
        startCandidates={canStart ? candidates : null}
        canFinish={canFinish}
        finishBlocked={finishBlocked}
        finishDescribedBy={canFinish && finishBlocked && showMissing ? BATCH_DATA_MISSING_ID : undefined}
      />
    </div>
  );

  return (
    <OperatorScreenFrame
      testId={CONDITIONING_ORDER_SCREEN_TESTID}
      // `canFinish` es «en acondicionamiento a nombre del propio actor»: ya comenzado, la vuelta
      // queda deshabilitada hasta terminar.
      back={{
        href: back.href,
        label: back.label,
        testId: CONDITIONING_ORDER_BACK_LINK_TESTID,
        disabled: canFinish,
      }}
      eyebrow={order.numberText}
      eyebrowTestId={CONDITIONING_ORDER_NUMBER_TESTID}
      title={order.recipeName ?? CONDITIONING_ORDER_SCREEN_TEXTS.recipeMissing}
      titleTestId={CONDITIONING_ORDER_RECIPE_TESTID}
      subtitle={
        <>
          <span
            className="block"
            data-testid={CONDITIONING_ORDER_QUANTITY_TESTID}
            title={exactDecimalTitle(order.quantity)}
          >
            {CONDITIONING_ORDER_SCREEN_TEXTS.quantityLabel} {formatDecimalDisplay(order.quantity)}
            {order.unitLabel === null ? null : ` ${order.unitLabel}`}
          </span>
          <div className="mt-2" data-testid={CONDITIONING_ORDER_DISTRIBUTION_TESTID}>
            <OrderDistributionFull lines={order.presentationLines} withImages />
          </div>
          {order.conditionedByName === null ? null : (
            <span className="block" data-testid={CONDITIONING_ORDER_CONDITIONER_TESTID}>
              {CONDITIONING_ORDER_SCREEN_TEXTS.conditionedBy(order.conditionedByName)}
            </span>
          )}
        </>
      }
      status={
        <StatusBadge
          tone={ORDER_STATUS_TONES[order.status]}
          label={ORDER_STATUS_LABELS[order.status]}
          data-testid={CONDITIONING_ORDER_STATUS_TESTID}
          data-status={order.status}
        />
      }
      // Mientras se recorren los pasos, el pie es el del paso a paso.
      footer={showsStepReader ? undefined : footer}
    >
      {candidatesError === null ? null : (
        <ErrorAlert
          error={candidatesError}
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          testId={CONDITIONING_ORDER_CANDIDATES_ERROR_TESTID}
          withDataCode
        />
      )}

      {conditioning !== null ? (
        // Paso a paso a la izquierda y las dos tarjetas a la derecha con más de 1100 px de
        // contenedor; por debajo, una columna con el paso a paso arriba.
        <div className="grid grid-cols-1 items-start gap-5 @min-[1101px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ConditioningStepsPanel
            orderId={order.id}
            conditioning={conditioning}
            view={showsStepReader ? 'steps' : 'done'}
            onViewChange={setStepsView}
            onCompletedChange={(count) => setRecordedCount((current) => Math.max(current, count))}
          />
          {teamCard === null && batchDataCard === null ? null : (
            <div className={cn('flex min-w-0 flex-col gap-5', showsStepReader && STEP_READER_SIDE_COLUMN_RESERVE)}>
              {teamCard}
              {batchDataCard}
            </div>
          )}
        </div>
      ) : order.team.length === 0 && batchData === null ? null : (
        // Dos tarjetas lado a lado con más de 1100 px de contenedor; una columna por debajo.
        <div className="grid grid-cols-1 items-start gap-5 @min-[1101px]:grid-cols-2">
          {teamCard}
          {batchDataCard}
        </div>
      )}
    </OperatorScreenFrame>
  );
}
