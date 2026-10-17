import { UrlTabs } from '@/components/shared/url-tabs';
import type { DataTableParams } from '@/components/shared/data-table';
import { PRODUCT_TYPE_VALUES, type ProductType } from '@/lib/modules/inventario';

import { productTypeTabHref, TYPE_COLUMN_ID } from './product-list-params';
import { PRODUCT_TYPE_LABELS } from './product-type-label';

export const PRODUCT_TYPE_TABS_LABEL = 'Filtrar por tipo de producto';
export const PRODUCT_TYPE_TABS_TESTID = 'product-type-tabs';
export const ALL_TYPES_TAB_LABEL = 'Todos';

export type ProductTypeTabsProps = {
  readonly params: DataTableParams;
};

function currentTypeOf(params: DataTableParams): ProductType | 'all' {
  const filter = params.filters[TYPE_COLUMN_ID];
  if (filter?.kind === 'select' && filter.values.length > 0) {
    return filter.values[0] as ProductType;
  }
  return 'all';
}

export function ProductTypeTabs({ params }: ProductTypeTabsProps) {
  const tabs: readonly { value: ProductType | 'all'; label: string }[] = [
    { value: 'all', label: ALL_TYPES_TAB_LABEL },
    ...PRODUCT_TYPE_VALUES.map((type) => ({ value: type, label: PRODUCT_TYPE_LABELS[type] })),
  ];

  return (
    <UrlTabs
      label={PRODUCT_TYPE_TABS_LABEL}
      testId={PRODUCT_TYPE_TABS_TESTID}
      current={currentTypeOf(params)}
      items={tabs.map(({ value, label }) => ({
        value,
        label,
        href: productTypeTabHref(params, value),
      }))}
    />
  );
}
