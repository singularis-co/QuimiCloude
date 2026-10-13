// Sin la directiva de cliente: la frontera la declara cada componente, no el barrel.
export { FinishedProductGeneral, type FinishedProductGeneralProps } from './finished-product-general';
export { FinishedProductHeader, type FinishedProductHeaderProps } from './finished-product-header';
export {
  FinishedProductListSection,
  finishedProductListEmptyTestId,
  finishedProductListErrorTestId,
  type FinishedProductListSectionProps,
} from './finished-product-list-section';
export {
  FinishedProductNotFound,
  type FinishedProductNotFoundProps,
} from './finished-product-not-found';
export {
  DEFAULT_FINISHED_PRODUCT_TAB,
  FINISHED_PRODUCT_TABLE_TEXTS,
  FINISHED_PRODUCT_TABS,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  TAB_PARAM,
  finishedProductPageHref,
  finishedProductTabHref,
  finishedProductTableParams,
  isFinishedProductListTab,
  isFinishedProductTab,
  parseFinishedProductParams,
  type FinishedProductListTab,
  type FinishedProductPaging,
  type FinishedProductSearchParams,
  type FinishedProductTab,
  type FinishedProductView,
} from './finished-product-params';
export {
  FinishedProductStock,
  packagedText,
  packagesText,
  quantityText,
  unitLabelOf,
  type FinishedProductStockProps,
} from './finished-product-stock';
export {
  FINISHED_PRODUCT_TAB_LABELS,
  FINISHED_PRODUCT_TABS_LABEL,
  FINISHED_PRODUCT_TABS_TESTID,
  FinishedProductTabs,
  finishedProductTabTestId,
  type FinishedProductTabsProps,
} from './finished-product-tabs';
