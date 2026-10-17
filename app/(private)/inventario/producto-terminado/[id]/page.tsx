import type { Metadata } from 'next';
import { Suspense } from 'react';

import {
  TYPE_PARAM,
  parseProductListParams,
  productListHref,
} from '@/app/(private)/inventario/components';
// Ruta directa: el botón es un módulo de cliente y el barrel de /inventario solo da valores de servidor.
import { DirectDeliveryButton } from '@/app/(private)/inventario/components/direct-delivery-button';
import { ErrorState } from '@/components/shared/error-state';
import { PageShell } from '@/components/shared/page-shell';
import { TableSkeleton } from '@/components/shared/table-skeleton';
import { identity } from '@/lib/composition';
import type { ErrorCode } from '@/lib/modules/errores';
import { assertPermission } from '@/lib/modules/identity';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { PRODUCT_TYPES } from '@/lib/modules/inventario';
import { getFinishedProductAction } from '@/lib/modules/inventario/adapters/driving/finished-product-actions';
import { listDirectDeliverySurplusAction } from '@/lib/modules/pedidos/adapters/driving/order-actions';
import { BRAND_LABEL } from '@/lib/shared/navigation/private-nav';

import {
  FinishedProductGeneral,
  FinishedProductHeader,
  FinishedProductListSection,
  FinishedProductNotFound,
  FinishedProductStock,
  FinishedProductTabs,
  isFinishedProductListTab,
  parseFinishedProductParams,
  unitLabelOf,
  type FinishedProductSearchParams,
} from './components';

export const metadata: Metadata = {
  title: `Producto terminado · ${BRAND_LABEL}`,
};

const PRODUCT_NOT_FOUND_CODE = 'product_not_found' satisfies ErrorCode;

const PAGE_ERROR_STATE = {
  title: 'No se pudo cargar el producto terminado.',
  testId: 'finished-product-error',
  messageTestId: 'finished-product-error-message',
  codeTestId: 'finished-product-error-code',
  retry: { kind: 'refresh' },
  retryTestId: 'finished-product-retry',
} as const;

const LIST_SKELETON_COLUMNS = 6;

const PERMISSION_DENIED = new Error('permiso denegado');

/**
 * Presentación, no autorización: decide si la cabecera pinta «Entregar»; la action de entregar vuelve a
 * exigir el permiso. Sin permiso, con error o sin excedente, el botón no existe.
 */
async function canDeliverDirect(productId: string): Promise<boolean> {
  try {
    assertPermission(await identity.getSessionUser(), 'entregas.modificar', () => PERMISSION_DENIED);
  } catch (error) {
    if (error !== PERMISSION_DENIED) throw error;
    return false;
  }
  try {
    const result = await listDirectDeliverySurplusAction([productId]);
    return result.status === 'success' && (result.data[productId] ?? 0) > 0;
  } catch {
    return false;
  }
}

// Sin `main`: el layout privado ya pone el único de la página.
export default async function FinishedProductDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<FinishedProductSearchParams>;
}) {
  await requirePagePermission('inventario.consultar');

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const view = parseFinishedProductParams(query);
  const finishedListHref = productListHref(
    parseProductListParams({ [TYPE_PARAM]: PRODUCT_TYPES.FINISHED_PRODUCT }),
  );
  const result = await getFinishedProductAction(id);

  if (result.status === 'error') {
    return (
      <PageShell>
        {result.code === PRODUCT_NOT_FOUND_CODE ? (
          <FinishedProductNotFound backHref={finishedListHref} />
        ) : (
          <ErrorState error={result} {...PAGE_ERROR_STATE} />
        )}
      </PageShell>
    );
  }

  const product = result.data;
  const unitLabel = unitLabelOf(product.unit);
  const { tab } = view;
  const deliverable = await canDeliverDirect(product.id);

  return (
    <PageShell>
      <FinishedProductHeader
        product={product}
        inventoryHref={productListHref(parseProductListParams({}))}
        finishedListHref={finishedListHref}
        actions={deliverable ? <DirectDeliveryButton productId={product.id} /> : undefined}
      />
      <FinishedProductTabs productId={product.id} current={tab} />
      {tab === 'general' ? <FinishedProductGeneral product={product} /> : null}
      {tab === 'stock' ? <FinishedProductStock stock={product.stock} unitLabel={unitLabel} /> : null}
      {isFinishedProductListTab(tab) ? (
        <Suspense
          key={tab}
          fallback={
            <TableSkeleton
              columns={LIST_SKELETON_COLUMNS}
              rows={view.pageSize}
              label="Cargando…"
              testId="finished-product-list-skeleton"
              rowTestId="finished-product-list-skeleton-row"
            />
          }
        >
          <FinishedProductListSection
            productId={product.id}
            tab={tab}
            paging={{ page: view.page, pageSize: view.pageSize }}
            unitLabel={unitLabel}
            presentation={product.presentation}
          />
        </Suspense>
      ) : null}
    </PageShell>
  );
}
