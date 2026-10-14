import { UrlTabs } from '@/components/shared/url-tabs';

import {
  FINISHED_PRODUCT_TABS,
  finishedProductTabHref,
  type FinishedProductTab,
} from './finished-product-params';

export const FINISHED_PRODUCT_TABS_LABEL = 'Secciones del producto terminado';
export const FINISHED_PRODUCT_TABS_TESTID = 'finished-product-tabs';

export const FINISHED_PRODUCT_TAB_LABELS: Readonly<Record<FinishedProductTab, string>> = {
  general: 'General',
  stock: 'Stock',
  lotes: 'Lotes',
  entradas: 'Entradas',
  salidas: 'Salidas',
  entregas: 'Entregas',
  costo: 'Costo de producción',
};

export function finishedProductTabTestId(tab: FinishedProductTab): string {
  return `finished-product-tab-${tab}`;
}

export type FinishedProductTabsProps = {
  readonly productId: string;
  readonly current: FinishedProductTab;
};

export function FinishedProductTabs({ productId, current }: FinishedProductTabsProps) {
  return (
    <UrlTabs
      label={FINISHED_PRODUCT_TABS_LABEL}
      testId={FINISHED_PRODUCT_TABS_TESTID}
      current={current}
      items={FINISHED_PRODUCT_TABS.map((tab) => ({
        value: tab,
        href: finishedProductTabHref(productId, tab),
        label: FINISHED_PRODUCT_TAB_LABELS[tab],
        testId: finishedProductTabTestId(tab),
      }))}
    />
  );
}
