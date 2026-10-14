// Sin la directiva de cliente: la frontera la declara cada componente, no el barrel.
export {
  FINISHED_PRODUCT_BATCHES_TABLE_ID,
  FinishedProductBatchesTable,
  WITHOUT_ORDER_LABEL,
  type FinishedProductBatchesTableProps,
} from './finished-product-batches-table';
export {
  FINISHED_PRODUCT_COSTS_TABLE_ID,
  FinishedProductCostsTable,
  type FinishedProductCostsTableProps,
} from './finished-product-costs-table';
export {
  DELETED_CUSTOMER_LABEL,
  FINISHED_PRODUCT_DELIVERIES_TABLE_ID,
  FinishedProductDeliveriesTable,
  DELIVERY_VOIDED_LABEL,
  type FinishedProductDeliveriesTableProps,
} from './finished-product-deliveries-table';
export { FinishedProductGeneral, type FinishedProductGeneralProps } from './finished-product-general';
export { FinishedProductHeader, type FinishedProductHeaderProps } from './finished-product-header';
export {
  FinishedProductListSection,
  finishedProductListEmptyTestId,
  finishedProductListErrorTestId,
  type FinishedProductListSectionProps,
} from './finished-product-list-section';
export {
  FINISHED_PRODUCT_MOVEMENT_KIND_LABELS,
  FinishedProductMovementsTable,
  movementDateText,
  type FinishedProductMovementsTab,
  type FinishedProductMovementsTableProps,
} from './finished-product-movements-table';
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
