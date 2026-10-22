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
import { assertPermission, type PermissionBearer } from '@/lib/modules/identity';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { canViewUnitCosts, PRODUCT_TYPES } from '@/lib/modules/inventario';
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
  resolveFinishedProductTab,
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
async function canDeliverDirect(actor: PermissionBearer | null, productId: string): Promise<boolean> {
  try {
    assertPermission(actor, 'entregas.modificar', () => PERMISSION_DENIED);
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
  // Presentacion, no autorizacion: decide si existe el tab de costos. Sin el permiso, un
  // `?tab=costo` escrito a mano cae al tab por defecto y la seccion de costos no se monta; el caso
  // de uso de costos rechaza igualmente a quien no es Administrador.
  // Una sola lectura de la sesion para los dos: el tab de costos y «Entregar».
  const sessionUser = await identity.getSessionUser();
  const canViewCosts = canViewUnitCosts(sessionUser);
  const tab = resolveFinishedProductTab(view.tab, canViewCosts);
  const deliverable = await canDeliverDirect(sessionUser, product.id);

  return (
    <PageShell>
      <FinishedProductHeader
        product={product}
        inventoryHref={productListHref(parseProductListParams({}))}
        finishedListHref={finishedListHref}
        actions={deliverable ? <DirectDeliveryButton productId={product.id} /> : undefined}
      />
      <FinishedProductTabs productId={product.id} current={tab} canViewCosts={canViewCosts} />
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
