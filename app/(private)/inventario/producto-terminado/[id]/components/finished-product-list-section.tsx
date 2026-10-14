import type { ReactNode } from 'react';

import { movementReasonLabel } from '@/app/(private)/inventario/components';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import type { ErrorState as OperationError } from '@/lib/modules/errores';
import { MOVEMENT_REASONS, type MovementReason, type Page } from '@/lib/modules/inventario';
import {
  listFinishedProductBatchesAction,
  listFinishedProductCostsAction,
  listFinishedProductDeliveriesAction,
  listFinishedProductMovementsAction,
} from '@/lib/modules/inventario/adapters/driving/finished-product-actions';

import { FinishedProductBatchesTable } from './finished-product-batches-table';
import { FinishedProductCostsTable } from './finished-product-costs-table';
import { FinishedProductDeliveriesTable } from './finished-product-deliveries-table';
import { FinishedProductMovementsTable } from './finished-product-movements-table';
import {
  finishedProductPageHref,
  type FinishedProductListTab,
  type FinishedProductPaging,
} from './finished-product-params';

const EMPTY_MESSAGES: Readonly<Record<FinishedProductListTab, string>> = {
  lotes: 'Este producto todavía no tiene lotes.',
  entradas: 'Este producto todavía no tiene entradas.',
  salidas: 'Este producto todavía no tiene salidas.',
  entregas: 'Este producto todavía no se ha entregado.',
  costo: 'Ningún lote de este producto salió de un pedido.',
};

const ERROR_TITLES: Readonly<Record<FinishedProductListTab, string>> = {
  lotes: 'No se pudieron cargar los lotes.',
  entradas: 'No se pudieron cargar las entradas.',
  salidas: 'No se pudieron cargar las salidas.',
  entregas: 'No se pudieron cargar las entregas.',
  costo: 'No se pudo cargar el costo de producción.',
};

const REASON_LABELS = Object.fromEntries(
  MOVEMENT_REASONS.map((reason) => [reason, movementReasonLabel(reason)]),
) as Readonly<Record<MovementReason, string>>;

export function finishedProductListEmptyTestId(tab: FinishedProductListTab): string {
  return `finished-product-${tab}-empty`;
}

export function finishedProductListErrorTestId(tab: FinishedProductListTab): string {
  return `finished-product-${tab}-error`;
}

export type FinishedProductListSectionProps = {
  readonly productId: string;
  readonly tab: FinishedProductListTab;
  readonly paging: FinishedProductPaging;
  readonly unitLabel: string | null;
};

type Result<T> = { readonly status: 'success'; readonly data: T } | OperationError;

function ListError({ tab, error }: { readonly tab: FinishedProductListTab; readonly error: OperationError }) {
  return (
    <ErrorState
      error={error}
      title={ERROR_TITLES[tab]}
      testId={finishedProductListErrorTestId(tab)}
      messageTestId={`${finishedProductListErrorTestId(tab)}-message`}
      codeTestId={`${finishedProductListErrorTestId(tab)}-code`}
      retry={{ kind: 'refresh' }}
      retryTestId={`${finishedProductListErrorTestId(tab)}-retry`}
    />
  );
}

/** Una página pasada del final no es un listado vacío: ofrece volver a la primera. */
function ListEmpty({
  productId,
  tab,
  paging,
  pastTheEnd,
}: {
  readonly productId: string;
  readonly tab: FinishedProductListTab;
  readonly paging: FinishedProductPaging;
  readonly pastTheEnd: boolean;
}) {
  return (
    <EmptyState
      testId={finishedProductListEmptyTestId(tab)}
      message={pastTheEnd ? 'Esta página ya no tiene filas.' : EMPTY_MESSAGES[tab]}
      firstPage={
        pastTheEnd
          ? {
              href: finishedProductPageHref(productId, tab, { page: 1, pageSize: paging.pageSize }),
              label: 'Volver a la primera página',
              testId: `${finishedProductListEmptyTestId(tab)}-first-page`,
            }
          : undefined
      }
    />
  );
}

function dispatch<P extends Page<unknown>>(
  props: FinishedProductListSectionProps,
  result: Result<P>,
  renderRows: (page: P) => ReactNode,
): ReactNode {
  if (result.status === 'error') return <ListError tab={props.tab} error={result} />;
  if (result.data.items.length === 0) {
    return (
      <ListEmpty
        productId={props.productId}
        tab={props.tab}
        paging={props.paging}
        pastTheEnd={result.data.total > 0}
      />
    );
  }
  return renderRows(result.data);
}

/** Pide solo el listado del tab activo. */
export async function FinishedProductListSection(props: FinishedProductListSectionProps) {
  const { productId, tab, paging, unitLabel } = props;
  const input = { page: paging.page, pageSize: paging.pageSize };

  switch (tab) {
    case 'lotes':
      return dispatch(props, await listFinishedProductBatchesAction(productId, input), (page) => (
        <FinishedProductBatchesTable productId={productId} page={page} unitLabel={unitLabel} />
      ));
    case 'entradas':
    case 'salidas':
      return dispatch(
        props,
        await listFinishedProductMovementsAction(productId, {
          ...input,
          direction: tab === 'entradas' ? 'in' : 'out',
        }),
        (page) => (
          <FinishedProductMovementsTable
            productId={productId}
            tab={tab}
            page={page}
            unitLabel={unitLabel}
            reasonLabels={REASON_LABELS}
          />
        ),
      );
    case 'entregas':
      return dispatch(props, await listFinishedProductDeliveriesAction(productId, input), (page) => (
        <FinishedProductDeliveriesTable productId={productId} page={page} unitLabel={unitLabel} />
      ));
    case 'costo':
      return dispatch(props, await listFinishedProductCostsAction(productId, input), (page) => (
        <FinishedProductCostsTable productId={productId} page={page} unitLabel={unitLabel} />
      ));
  }
}
