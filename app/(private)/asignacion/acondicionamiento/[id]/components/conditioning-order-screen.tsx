'use client';

import { PackageIcon, UsersIcon } from 'lucide-react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Notice } from '@/components/shared/notice';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ConditioningOrderDetail, ConditioningTeamCandidates } from '@/lib/modules/asignaciones';
import type { ErrorState } from '@/lib/modules/errores';
import type { OrderStatus } from '@/lib/modules/pedidos';
import { exactDecimalTitle, formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

// Por su archivo y no por el barrel: esta pantalla es de cliente y el barrel reexporta secciones
// de servidor.
import { assignmentViewHref } from '../../../components/assignment-view-params';
import { OperatorScreenFrame } from '../../../components/operator-screen-frame';
import { useOperatorSidePanels, type OperatorSection } from '../../../components/operator-side-panels';
import { OrderDistributionFull, orderDistributionFullText } from '../../../components/order-distribution-full';

import { CONDITIONING_ACTIONS_TEXTS, ConditioningActions } from './conditioning-actions';
import { ConditioningBatchDataForm } from './conditioning-batch-data-form';
import { CONDITIONING_TEAM_LIST_TEXTS, ConditioningTeamList } from './conditioning-team-list';

/**
 * El detalle de un pedido para quien acondiciona, sobre el marco del operario. Qué acción se
 * ofrece lo decide la página; la autorización real la hacen los casos de uso.
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
export const CONDITIONING_ORDER_NOT_STARTED_TESTID = 'conditioning-order-not-started';
export const CONDITIONING_ORDER_SECTIONS_TESTID = 'conditioning-order-sections';
export const CONDITIONING_ORDER_MAIN_TESTID = 'conditioning-order-main';

export const CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS = {
  card: 'conditioning-order-packages',
  trigger: 'conditioning-order-packages-trigger',
  count: 'conditioning-order-packages-count',
  content: 'conditioning-order-packages-content',
  fab: 'conditioning-order-packages-fab',
} as const;

export const CONDITIONING_ORDER_TEAM_SECTION_TESTIDS = {
  card: 'conditioning-order-team',
  trigger: 'conditioning-order-team-trigger',
  count: 'conditioning-order-team-count',
  content: 'conditioning-order-team-content',
  fab: 'conditioning-order-team-fab',
} as const;

export const CONDITIONING_ORDER_SCREEN_TEXTS = {
  phase: 'Acondicionamiento',
  running: 'Acondicionando',
  recipeMissing: 'Esta receta está dada de baja.',
  quantityLabel: 'Cantidad',
  packagesTitle: 'Envases',
  conditionedBy: (name: string) => `Lo acondiciona ${name}.`,
  notStartedTitle: 'Revisa antes de comenzar',
  notStartedBody: 'Al comenzar, el equipo queda registrado y el pedido pasa a «En acondicionamiento».',
  backToQueue: 'Volver a «Por acondicionar»',
  backToConditioned: 'Volver a «Acondicionados»',
  backToDelivered: 'Volver a «Entregados»',
  batchDataMissing: (count: number) =>
    count === 1 ? 'Faltan los datos de lote de 1 línea.' : `Faltan los datos de lote de ${count} líneas.`,
} as const;

const BATCH_DATA_MISSING_ID = 'conditioning-order-batch-data-missing';

function backLink(status: OrderStatus): { readonly href: string; readonly label: string } {
  if (status === 'TERMINADO') {
    return { href: assignmentViewHref('acondicionados'), label: CONDITIONING_ORDER_SCREEN_TEXTS.backToConditioned };
  }
  if (status === 'ENTREGADO') {
    return {
      href: assignmentViewHref('acondicionados_entregados'),
      label: CONDITIONING_ORDER_SCREEN_TEXTS.backToDelivered,
    };
  }
  return { href: assignmentViewHref('por_acondicionar'), label: CONDITIONING_ORDER_SCREEN_TEXTS.backToQueue };
}

/** Por qué el actor no puede actuar sobre el pedido, o `null` si puede. */
export function conditioningBlockedReason(
  order: Pick<ConditioningOrderDetail, 'status' | 'conditionedByName'>,
  { canStart, canFinish, candidates }: {
    readonly canStart: boolean;
    readonly canFinish: boolean;
    readonly candidates: ConditioningTeamCandidates | null;
  },
): string | null {
  if (order.status === 'TERMINADO') return CONDITIONING_ACTIONS_TEXTS.finished;
  if (order.status === 'ENTREGADO') return CONDITIONING_ACTIONS_TEXTS.delivered;
  if (order.status === 'EN_ACONDICIONAMIENTO' && !canFinish && order.conditionedByName !== null) {
    return CONDITIONING_ORDER_SCREEN_TEXTS.conditionedBy(order.conditionedByName);
  }
  if (order.status === 'POR_ACONDICIONAR' && !(canStart && candidates !== null)) {
    return CONDITIONING_ACTIONS_TEXTS.noCandidates;
  }
  return null;
}

export type ConditioningOrderScreenProps = {
  readonly order: ConditioningOrderDetail;
  readonly canStart?: boolean;
  readonly canFinish?: boolean;
  /** «Terminar» se ofrece deshabilitado. */
  readonly finishBlocked?: boolean;
  readonly candidates?: ConditioningTeamCandidates | null;
  readonly candidatesError?: ErrorState | null;
  /** Usuario de la sesión: su fila del equipo lleva la marca «Tú». */
  readonly actorId?: string | null;
};

export function ConditioningOrderScreen({
  order,
  canStart = false,
  canFinish = false,
  finishBlocked = false,
  candidates = null,
  candidatesError = null,
  actorId = null,
}: ConditioningOrderScreenProps) {
  const back = backLink(order.status);
  const batchData = order.batchData;
  const missingCount = batchData?.missingCount ?? 0;
  const showMissing = canFinish && missingCount > 0;
  const blockedReason = conditioningBlockedReason(order, { canStart, canFinish, candidates });

  const sections: OperatorSection[] = [
    {
      key: 'materials',
      title: CONDITIONING_ORDER_SCREEN_TEXTS.packagesTitle,
      icon: PackageIcon,
      count: order.presentationLines.length,
      content: (
        <div data-testid={CONDITIONING_ORDER_DISTRIBUTION_TESTID}>
          <OrderDistributionFull lines={order.presentationLines} withImages />
        </div>
      ),
      testIds: CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS,
    },
  ];
  if (order.team.length > 0) {
    sections.push({
      key: 'team',
      title: CONDITIONING_TEAM_LIST_TEXTS.title,
      icon: UsersIcon,
      count: order.team.length,
      content: <ConditioningTeamList team={order.team} actorId={actorId} />,
      testIds: CONDITIONING_ORDER_TEAM_SECTION_TESTIDS,
    });
  }
  const { column, overlay } = useOperatorSidePanels({ sections, columnTestId: CONDITIONING_ORDER_SECTIONS_TESTID });

  return (
    <OperatorScreenFrame
      testId={CONDITIONING_ORDER_SCREEN_TESTID}
      phaseLabel={CONDITIONING_ORDER_SCREEN_TEXTS.phase}
      running={canFinish ? CONDITIONING_ORDER_SCREEN_TEXTS.running : undefined}
      back={{ href: back.href, label: back.label, testId: CONDITIONING_ORDER_BACK_LINK_TESTID }}
      eyebrow={order.numberText}
      eyebrowTestId={CONDITIONING_ORDER_NUMBER_TESTID}
      title={order.recipeName ?? CONDITIONING_ORDER_SCREEN_TEXTS.recipeMissing}
      titleTestId={CONDITIONING_ORDER_RECIPE_TESTID}
      quantity={
        <span
          className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-muted/50 px-3 text-sm"
          data-testid={CONDITIONING_ORDER_QUANTITY_TESTID}
          title={exactDecimalTitle(order.quantity)}
        >
          <span className="text-muted-foreground">{CONDITIONING_ORDER_SCREEN_TEXTS.quantityLabel}</span>{' '}
          <span className="font-mono font-semibold tabular-nums">
            {formatDecimalDisplay(order.quantity)}
            {order.unitLabel === null ? null : ` ${order.unitLabel}`}
          </span>
        </span>
      }
      status={
        <StatusBadge
          tone={ORDER_STATUS_TONES[order.status]}
          label={ORDER_STATUS_LABELS[order.status]}
          data-testid={CONDITIONING_ORDER_STATUS_TESTID}
          data-status={order.status}
        />
      }
      footer={
        <div className="flex flex-col items-center gap-2">
          {showMissing ? (
            <p
              id={BATCH_DATA_MISSING_ID}
              className="text-center text-base font-medium"
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
            finishDescribedBy={finishBlocked && showMissing ? BATCH_DATA_MISSING_ID : undefined}
            blockedReason={blockedReason}
          />
        </div>
      }
      overlay={overlay}
    >
      <div className="grid grid-cols-1 items-start gap-5 @min-[1001px]:grid-cols-[320px_minmax(0,1fr)]">
        {column}

        <div className="flex min-w-0 flex-col gap-5" data-testid={CONDITIONING_ORDER_MAIN_TESTID}>
          {candidatesError === null ? null : (
            <ErrorAlert
              error={candidatesError}
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
              testId={CONDITIONING_ORDER_CANDIDATES_ERROR_TESTID}
              withDataCode
            />
          )}

          {order.conditionedByName === null ? null : (
            <Notice tone="info" testId={CONDITIONING_ORDER_CONDITIONER_TESTID}>
              {CONDITIONING_ORDER_SCREEN_TEXTS.conditionedBy(order.conditionedByName)}
            </Notice>
          )}

          {order.status === 'POR_ACONDICIONAR' ? (
            <Card
              className="gap-2 border-2 border-dashed border-border px-5 ring-0"
              data-testid={CONDITIONING_ORDER_NOT_STARTED_TESTID}
            >
              <h3 className="m-0 text-lg font-semibold">{CONDITIONING_ORDER_SCREEN_TEXTS.notStartedTitle}</h3>
              <p className="m-0 text-base text-muted-foreground">{CONDITIONING_ORDER_SCREEN_TEXTS.notStartedBody}</p>
            </Card>
          ) : null}

          {batchData === null ? null : (
            <Card>
              <CardContent>
                <ConditioningBatchDataForm
                  orderId={order.id}
                  form={batchData.form}
                  divergentLabels={Object.fromEntries(
                    batchData.lines.map((line) => [line.presentationId, orderDistributionFullText([line])]),
                  )}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </OperatorScreenFrame>
  );
}
