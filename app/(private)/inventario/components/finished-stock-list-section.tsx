import type { DataTableParams } from '@/components/shared/data-table';
import { identity } from '@/lib/composition';
import { assertPermission, type PermissionCode, type SessionUser } from '@/lib/modules/identity';
import { canAdjustBatchStock, type FinishedStockRow } from '@/lib/modules/inventario';
import { listFinishedStockAction } from '@/lib/modules/inventario/adapters/driving/product-actions';
import { DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS } from '@/lib/modules/pedidos';
import { listDirectDeliverySurplusAction } from '@/lib/modules/pedidos/adapters/driving/order-actions';
import type { UnitRef } from '@/lib/modules/unidades';

import { FinishedStockTable } from './finished-stock-table';
import { TYPE_COLUMN_ID } from './product-list-params';

const PERMISSION_DENIED = new Error('permiso denegado');

// Presentacion, no autorizacion: cada Server Action vuelve a exigir el permiso.
function hasPermission(user: SessionUser | null, code: PermissionCode): boolean {
  try {
    assertPermission(user, code, () => PERMISSION_DENIED);
    return true;
  } catch (error) {
    if (error !== PERMISSION_DENIED) throw error;
    return false;
  }
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

/** Un fallo deja el mapa vacio: sin excedente leido, ninguna fila ofrece «Entregar». */
async function loadSurplusByProduct(rows: readonly FinishedStockRow[]): Promise<Readonly<Record<string, number>>> {
  const productIds = [...new Set(rows.flatMap((row) => row.products.map((line) => line.product.id)))];
  if (productIds.length === 0) return {};
  let results: Awaited<ReturnType<typeof listDirectDeliverySurplusAction>>[];
  try {
    results = await Promise.all(
      chunks(productIds, DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS).map((ids) => listDirectDeliverySurplusAction(ids)),
    );
  } catch {
    return {};
  }
  const surplus: Record<string, number> = {};
  for (const result of results) {
    if (result.status === 'error') return {};
    Object.assign(surplus, result.data);
  }
  return surplus;
}

type FinishedStockListSectionProps = {
  readonly params: DataTableParams;
  readonly units?: readonly UnitRef[];
};

/**
 * Lista de la pestana «Producto terminado». Esta lista no ordena ni filtra: de la URL solo
 * viajan pagina, tamano y busqueda. El filtro de tipo se conserva en los parametros de la tabla
 * para que paginar o buscar no saque al usuario de la pestana.
 */
export async function FinishedStockListSection({ params, units }: FinishedStockListSectionProps) {
  const result = await listFinishedStockAction({
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    sort: null,
    filters: {},
  });

  if (result.status === 'error') {
    return (
      <FinishedStockTable
        status="error"
        error={result}
        rows={[]}
        params={params}
        totalPages={0}
        units={units}
      />
    );
  }

  const { items, page: currentPage, totalPages } = result.data;
  const user = await identity.getSessionUser();
  // Presentacion, no autorizacion: el ajuste lo autoriza el caso de uso.
  const canAdjust = canAdjustBatchStock(user);
  const surplusByProduct = hasPermission(user, 'entregas.modificar') ? await loadSurplusByProduct(items) : {};
  const typeFilter = params.filters[TYPE_COLUMN_ID];

  return (
    <div className="flex flex-col gap-4" data-testid="product-list">
      <FinishedStockTable
        rows={items}
        params={{
          ...params,
          page: currentPage,
          sort: null,
          filters: typeFilter === undefined ? {} : { [TYPE_COLUMN_ID]: typeFilter },
        }}
        totalPages={totalPages}
        units={units}
        canAdjust={canAdjust}
        surplusByProduct={surplusByProduct}
      />
    </div>
  );
}
