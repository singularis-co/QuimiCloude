import { UrlTabs } from '@/components/shared/url-tabs';

import {
  finishedProductTabHref,
  visibleFinishedProductTabs,
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
  reparto: 'Reparto',
};

export function finishedProductTabTestId(tab: FinishedProductTab): string {
  return `finished-product-tab-${tab}`;
}

export type FinishedProductTabsProps = {
  readonly productId: string;
  readonly current: FinishedProductTab;
  /**
   * Si se pinta el tab «Costo de producción» (solo el Administrador). Lo resuelve la pagina con
   * `canViewUnitCosts` y baja por props. Defecto `false`: falla cerrado.
   */
  readonly canViewCosts?: boolean;
};

export function FinishedProductTabs({
  productId,
  current,
  canViewCosts = false,
}: FinishedProductTabsProps) {
  return (
    <UrlTabs
      label={FINISHED_PRODUCT_TABS_LABEL}
      testId={FINISHED_PRODUCT_TABS_TESTID}
      current={current}
      items={visibleFinishedProductTabs(canViewCosts).map((tab) => ({
        value: tab,
        href: finishedProductTabHref(productId, tab),
        label: FINISHED_PRODUCT_TAB_LABELS[tab],
        testId: finishedProductTabTestId(tab),
      }))}
    />
  );
}
