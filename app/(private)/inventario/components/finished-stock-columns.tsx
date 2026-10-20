'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { withCardFieldLabel } from '@/components/shared/card-field-label';
import { actionsColumn, type DataTableColumn, type RowActionsSpec } from '@/components/shared/data-table';
import { EntityImage } from '@/components/shared/entity-image';
import { Button } from '@/components/ui/button';
import type {
  FinishedStockProductLine,
  FinishedStockRow,
  PackagedStockEntry,
} from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { finishedProductDetailRoute } from '@/lib/shared/routes';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import {
  ACTIONS_COLUMN_ID,
  ACTIONS_COLUMN_LABEL,
  BELOW_ALERT_CLASS,
  BelowAlertMark,
  IMAGE_COLUMN_ID,
  IMAGE_COLUMN_LABEL,
  isBelowAlert,
  PRODUCT_CARD_LABELS,
  productUnitLabel,
  qtyAlertCell,
  stockAmountCell,
  unitLabel,
} from './product-columns';
import { productNameWithoutPresentation } from './product-base-name';

/** Fila que pinta la tabla: la del pedido (o sin pedido) y, desplegada, una por producto. */
export type FinishedStockTableRow =
  | { readonly kind: 'group'; readonly row: FinishedStockRow; readonly expanded: boolean }
  | {
      readonly kind: 'line';
      readonly parent: FinishedStockRow;
      readonly line: FinishedStockProductLine;
    };

/** «6 × Botella 250 ml, 1 × Botella 1 L»; el resto que no llena un envase va tras un «+». */
export function packagedStockLabel(
  entries: readonly PackagedStockEntry[],
  units: readonly UnitRef[] | undefined,
): string {
  return entries
    .map((entry) => {
      const packages = `${entry.packages} × ${entry.name}`;
      if (entry.remainder === null) return packages;
      const symbol = unitLabel(entry.unitId, units);
      return symbol === null
        ? `${packages} + ${entry.remainder}`
        : `${packages} + ${entry.remainder} ${symbol}`;
    })
    .join(', ');
}

/** Nombre visible de la fila agrupadora. */
export function finishedStockRowTitle(row: FinishedStockRow): string {
  if (row.kind === 'withoutOrder') return `Sin pedido · ${row.products[0].product.name}`;
  const order = `Pedido ${row.numberText}`;
  return row.recipeName === null ? order : `${order} · ${row.recipeName}`;
}

/** Lo que pinta la columna «Nombre» en la fila agrupadora: el producto, sin el pedido. */
export function finishedStockRowName(row: FinishedStockRow): string {
  if (row.kind === 'withoutOrder') return productNameWithoutPresentation(row.products[0].product);
  return row.recipeName ?? EMPTY_MARK;
}

/** La presentacion va en su columna; la fila de un pedido no tiene una sola. */
function presentationCell(item: FinishedStockTableRow): ReactNode {
  if (item.kind === 'line') return item.line.product.presentationName ?? EMPTY_MARK;
  if (item.row.kind === 'order') return null;
  return item.row.products[0].product.presentationName ?? EMPTY_MARK;
}

function orderNumberCell(row: FinishedStockRow): ReactNode {
  const text = row.kind === 'order' ? row.numberText : 'Sin pedido';
  return (
    <span className="font-medium" data-testid="finished-stock-order-number">
      {text}
    </span>
  );
}

function packagedStockCell(
  entries: readonly PackagedStockEntry[] | null,
  units: readonly UnitRef[] | undefined,
  alerted = false,
): ReactNode {
  if (entries === null) return EMPTY_MARK;
  const label = packagedStockLabel(entries, units);

  return (
    <span
      data-testid="finished-stock-packaged"
      data-alert={alerted ? 'true' : undefined}
      className={alerted ? BELOW_ALERT_CLASS : undefined}
      title={label}
      aria-label={label}
    >
      {alerted ? <BelowAlertMark /> : null}
      {label}
    </span>
  );
}

function groupStockCell(row: FinishedStockRow, units: readonly UnitRef[] | undefined): ReactNode {
  if (row.kind === 'order') return packagedStockCell(row.packagedStock, units);
  const label = row.unitId === null ? null : unitLabel(row.unitId, units);
  return stockAmountCell(row.stock, label, false);
}

function lineStockCell(
  line: FinishedStockProductLine,
  units: readonly UnitRef[] | undefined,
): ReactNode {
  const alerted = isBelowAlert(line.product);
  if (line.packagedStock !== null) return packagedStockCell(line.packagedStock, units, alerted);
  return stockAmountCell(line.stock, productUnitLabel(line.product, units), alerted);
}

/** La fila del pedido no tiene menú: sin ítems, no se pinta. */
const NO_GROUP_ACTIONS: RowActionsSpec = { items: [], triggerLabel: '' };

export type FinishedStockColumnsDeps = {
  readonly onToggle: (key: string) => void;
  /** El menú de una línea de producto, como datos: lo pintan la fila y la tarjeta. */
  readonly menu: (parent: FinishedStockRow, line: FinishedStockProductLine) => RowActionsSpec;
  readonly units?: readonly UnitRef[];
};

export function buildFinishedStockColumns({
  onToggle,
  menu,
  units,
}: FinishedStockColumnsDeps): readonly DataTableColumn<FinishedStockTableRow>[] {
  return [
    {
      id: IMAGE_COLUMN_ID,
      label: IMAGE_COLUMN_LABEL,
      align: 'center',
      defaultPinned: 'left',
      cell: (item) =>
        item.kind === 'group' ? (
          <EntityImage
            path={null}
            name={finishedStockRowTitle(item.row)}
            testId="finished-stock-image"
          />
        ) : (
          <EntityImage
            path={item.line.product.imagePath}
            name={item.line.product.name}
            testId="product-image"
          />
        ),
    },
    {
      id: 'orderNumber',
      label: '# Pedido',
      align: 'start',
      cell: (item) => (item.kind === 'group' ? orderNumberCell(item.row) : null),
    },
    {
      id: 'name',
      label: 'Nombre',
      align: 'start',
      width: 500,
      hideText: false,
      cell: (item) => {
        if (item.kind === 'line') {
          return (
            <span className="block pl-12">
              <Link
                href={finishedProductDetailRoute(item.line.product.id)}
                data-testid="finished-stock-line-link"
                className={cn(
                  'inline-flex max-w-full items-center rounded-lg font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none',
                  touchTarget,
                )}
              >
                <span className="min-w-0 break-words" data-testid="finished-stock-line-name">
                  {productNameWithoutPresentation(item.line.product)}
                </span>
              </Link>
            </span>
          );
        }
        const title = finishedStockRowTitle(item.row);
        return (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              touch
              className="shrink-0"
              aria-expanded={item.expanded}
              aria-label={`Productos de ${title}`}
              data-testid="finished-stock-toggle"
              onClick={() => onToggle(item.row.key)}
            >
              <ChevronRight
                aria-hidden="true"
                className={cn('transition-transform', item.expanded && 'rotate-90')}
              />
            </Button>
            <span className="font-medium" data-testid="finished-stock-name">
              {finishedStockRowName(item.row)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'presentationName',
      label: 'Presentación',
      align: 'start',
      cell: presentationCell,
    },
    {
      id: 'stock',
      label: 'Existencia',
      tabular: true,
      align: 'end',
      cell: (item) =>
        withCardFieldLabel(
          PRODUCT_CARD_LABELS.stock,
          item.kind === 'group' ? groupStockCell(item.row, units) : lineStockCell(item.line, units),
        ),
    },
    {
      id: 'qtyAlert',
      label: 'Alerta de cantidad',
      tabular: true,
      align: 'end',
      cell: (item) =>
        item.kind === 'line'
          ? withCardFieldLabel(PRODUCT_CARD_LABELS.qtyAlert, qtyAlertCell(item.line.product, units))
          : null,
    },
    actionsColumn<FinishedStockTableRow>({
      id: ACTIONS_COLUMN_ID,
      label: ACTIONS_COLUMN_LABEL,
      defaultPinned: 'right',
      menu: (item) => (item.kind === 'line' ? menu(item.parent, item.line) : NO_GROUP_ACTIONS),
    }),
  ];
}
