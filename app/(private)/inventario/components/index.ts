// Barrel de los componentes de la ruta de inventario (R27,
// `docs/architecture.md > Componentes > Regla: componentes de ruta en components/ con barrel index.ts`).
//
// Sin `'use client'`: la frontera cliente/servidor se declara en CADA archivo de componente,
// nunca aqui. Asi `page.tsx` sigue siendo Server Component aunque importe desde el barrel.
export { AdjustBatchDialog, type AdjustBatchDialogProps } from './adjust-batch-dialog';
export { BatchHistory, movementKindLabel } from './batch-history';
export { DeleteProductDialog } from './delete-product-dialog';
export {
  buildFinishedStockColumns,
  finishedStockRowName,
  finishedStockRowTitle,
  packagedStockLabel,
  type FinishedStockColumnsDeps,
  type FinishedStockTableRow,
} from './finished-stock-columns';
export { FinishedStockListSection } from './finished-stock-list-section';
export { movementReasonLabel } from './movement-reason-label';
export {
  FINISHED_STOCK_TABLE_ID,
  FINISHED_STOCK_TABLE_TEXTS,
  FinishedStockTable,
  type FinishedStockTableProps,
} from './finished-stock-table';
// `PresentationSelect` ya no es propio de esta ruta: QC-44 lo promovio a
// `components/shared/` porque la pantalla de proveedores lo necesita con la MISMA API
// (`docs/architecture.md > Regla: sin sobre-ingenieria`). Se reexporta aqui para que la
// ruta lo siga consumiendo por su barrel, sin cambiar ni un consumidor.
export { PRESENTATION_FIELD, PresentationSelect } from '@/components/shared/presentation-select';
export {
  ACTIONS_COLUMN_ID,
  BELOW_ALERT_LABEL,
  IMAGE_COLUMN_ID,
  PRODUCT_BATCH_ROW_TEXTS,
  buildProductColumns,
  productUnitLabel,
  type ProductBatchesStatus,
  type ProductColumn,
  type ProductColumnId,
  type ProductColumnsDeps,
  type ProductTableRow,
} from './product-columns';
export {
  daysUntil,
  EXPIRY_RELATIVE_TEXTS,
  EXPIRY_WARNING_DAYS,
  expiryRelativeLabel,
  isExpired,
  isExpiringSoon,
} from './expiry-warning';
export { ExpiryDate, type ExpiryDateProps, useLocalToday } from './expiry-date';
export { PRODUCT_SKELETON_COLUMN_COUNT } from './product-columns-skeleton';
export { productNameWithoutPresentation } from './product-base-name';
export {
  PRODUCT_ACTION_ADJUST_TESTID,
  PRODUCT_ACTION_BATCHES_TESTID,
  PRODUCT_ACTION_DELETE_TESTID,
  PRODUCT_ACTION_EDIT_TESTID,
  PRODUCT_ACTION_HISTORY_TESTID,
  PRODUCT_ROW_ACTION_LABELS,
  PRODUCT_ROW_ACTIONS_TESTID,
  ProductRowActions,
  productRowActionsLabel,
  productRowActionsSpec,
  type ProductRowAction,
  type ProductRowActionsProps,
  type ProductRowActionsSpec,
  type ProductRowActionsSpecInput,
} from './product-row-actions';
export {
  ProductRowDialogs,
  batchTarget,
  type BatchTarget,
  type ProductRowDialogsActive,
  type ProductRowDialogsProps,
} from './product-row-dialogs';
export {
  COST_INPUT_SCALE,
  divideCost,
  multiplyCost,
  sanitizeCostInput,
} from './product-cost-amount';
export { ProductCostFields } from './product-cost-fields';
export { ProductField, ProductFieldHelper } from './product-field';
export { ProductForm } from './product-form';
export {
  EXPIRY_DATE_FIELD,
  PURCHASE_DATE_FIELD,
  ProductBatchDateField,
  type ProductBatchDateFieldName,
} from './product-batch-date-field';
export {
  ProductBatchesPanel,
  type ProductBatchesPanelProps,
} from './product-batches-panel';
export {
  ProductBatchesSheet,
  type ProductBatchesSheetProps,
} from './product-batches-sheet';
export {
  PRODUCT_NAME_FIELD,
  ProductNamePicker,
  type ProductNameOption,
} from './product-name-picker';
export {
  FIRST_PAGE,
  PAGE_PARAM,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_PARAM,
  QTY_ALERT_COLUMN_ID,
  QTY_ALERT_MAX_PARAM,
  QTY_ALERT_MIN_PARAM,
  SEARCH_PARAM,
  SHARED_PAGE_SIZES,
  SORT_PARAM,
  SORT_SEPARATOR,
  STOCK_COLUMN_ID,
  STOCK_MAX_PARAM,
  STOCK_MIN_PARAM,
  TYPE_COLUMN_ID,
  TYPE_PARAM,
  buildProductListQuery,
  parseProductListParams,
  productListHref,
  productTypeTabHref,
  type ProductListSearchParams,
  type ProductPageSize,
} from './product-list-params';
export { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_TONES } from './product-type-label';
export {
  ALL_TYPES_TAB_LABEL,
  PRODUCT_TYPE_TABS_LABEL,
  PRODUCT_TYPE_TABS_TESTID,
  ProductTypeTabs,
  type ProductTypeTabsProps,
} from './product-type-tabs';
export { ProductListSection } from './product-list-section';
export { ProductSheet } from './product-sheet';
export {
  PRODUCT_TABLE_ID,
  PRODUCT_TABLE_TEXTS,
  ProductTable,
  type ProductTableProps,
} from './product-table';
