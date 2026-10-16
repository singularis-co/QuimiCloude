import type { ReactNode } from 'react';

import { EntityImage } from '@/components/shared/entity-image';
import { PageHeader } from '@/components/shared/page-header';
import type { FinishedProductDetail } from '@/lib/modules/inventario';

export type FinishedProductHeaderProps = {
  readonly product: Pick<FinishedProductDetail, 'name' | 'imagePath'>;
  readonly inventoryHref: string;
  readonly finishedListHref: string;
  /** Va fuera de los tabs: se ve en todos. */
  readonly actions?: ReactNode;
};

export function FinishedProductHeader({
  product,
  inventoryHref,
  finishedListHref,
  actions,
}: FinishedProductHeaderProps) {
  return (
    <div className="flex items-end gap-4">
      <EntityImage path={product.imagePath} name={product.name} testId="finished-product-image" />
      <div className="min-w-0 flex-1">
        <PageHeader
          title={product.name}
          titleTestId="finished-product-name"
          actions={actions}
          breadcrumb={{
            label: 'Ruta de navegación',
            items: [
              { label: 'Inventario', href: inventoryHref },
              { label: 'Producto terminado', href: finishedListHref },
              { label: product.name },
            ],
          }}
        />
      </div>
    </div>
  );
}
