'use client';

import { HistoryIcon, LayersIcon, PencilIcon, ScaleIcon, Trash2Icon } from 'lucide-react';

import type { RowActionsSpec } from '@/components/shared/data-table';
import {
  RowActionsMenu,
  type RowActionMenuItem,
  type RowActionsMenuProps,
} from '@/components/shared/row-actions-menu';
import { productDisplayName, type ProductView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';

import { productNameWithoutPresentation } from './product-base-name';
import { productUnitLabel } from './product-columns';

export const PRODUCT_ROW_ACTIONS_TESTID = 'product-row-actions';
export const PRODUCT_ACTION_BATCHES_TESTID = 'product-batches-open';
export const PRODUCT_ACTION_HISTORY_TESTID = 'product-history-open';
export const PRODUCT_ACTION_ADJUST_TESTID = 'product-adjust-open';
export const PRODUCT_ACTION_EDIT_TESTID = 'product-edit-open';
export const PRODUCT_ACTION_DELETE_TESTID = 'product-delete-open';

export const PRODUCT_ROW_ACTION_LABELS = {
  batches: 'Lotes',
  history: 'Historial',
  adjust: 'Ajustar existencia',
  edit: 'Editar',
  delete: 'Borrar',
} as const;

/** Nombre accesible del disparador del menu de la fila. */
export function productRowActionsLabel(name: string): string {
  return `Acciones de ${name}`;
}

export type ProductRowAction = 'batches' | 'history' | 'adjust' | 'edit' | 'delete';

// La especificación llega a `RowActionsMenu` por propagación: `data-product-id` sale en el
// disparador de la fila y en el de la tarjeta.
export type ProductRowActionsSpec = RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>;

export type ProductRowActionsSpecInput = {
  readonly product: ProductView;
  readonly units?: readonly UnitRef[];
  /** Falla cerrado: el permiso baja por props, esta pantalla no lo resuelve. */
  readonly canAdjust: boolean;
  readonly onAction: (action: ProductRowAction, product: ProductView) => void;
};

export function productRowActionsSpec({
  product,
  units,
  canAdjust,
  onAction,
}: ProductRowActionsSpecInput): ProductRowActionsSpec {
  const emit = (action: ProductRowAction) => () => onAction(action, product);

  const items: RowActionMenuItem[] = [
    {
      key: 'batches',
      label: PRODUCT_ROW_ACTION_LABELS.batches,
      icon: LayersIcon,
      onSelect: emit('batches'),
      testId: PRODUCT_ACTION_BATCHES_TESTID,
    },
    {
      key: 'history',
      label: PRODUCT_ROW_ACTION_LABELS.history,
      icon: HistoryIcon,
      onSelect: emit('history'),
      testId: PRODUCT_ACTION_HISTORY_TESTID,
    },
  ];

  if (canAdjust) {
    items.push({
      key: 'adjust',
      label: PRODUCT_ROW_ACTION_LABELS.adjust,
      icon: ScaleIcon,
      onSelect: emit('adjust'),
      testId: PRODUCT_ACTION_ADJUST_TESTID,
    });
  }

  items.push(
    {
      key: 'edit',
      label: PRODUCT_ROW_ACTION_LABELS.edit,
      icon: PencilIcon,
      onSelect: emit('edit'),
      testId: PRODUCT_ACTION_EDIT_TESTID,
    },
    {
      key: 'delete',
      label: PRODUCT_ROW_ACTION_LABELS.delete,
      icon: Trash2Icon,
      onSelect: emit('delete'),
      destructive: true,
      separatorBefore: true,
      testId: PRODUCT_ACTION_DELETE_TESTID,
    },
  );

  return {
    items,
    triggerLabel: productRowActionsLabel(
      productDisplayName(product.name, productUnitLabel(product, units)),
    ),
    triggerTestId: PRODUCT_ROW_ACTIONS_TESTID,
    triggerDataAttributes: { 'data-product-id': product.id },
    title: productNameWithoutPresentation(product),
  };
}

export type ProductRowActionsProps = ProductRowActionsSpecInput &
  Pick<RowActionsMenuProps, 'presentation' | 'texts'>;

/** El menú de la fila de un producto; lo que abre cada ítem lo monta quien recibe `onAction`. */
export function ProductRowActions({ presentation, texts, ...input }: ProductRowActionsProps) {
  return <RowActionsMenu {...productRowActionsSpec(input)} presentation={presentation} texts={texts} />;
}
