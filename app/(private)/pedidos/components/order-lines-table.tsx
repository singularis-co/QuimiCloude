'use client';

import { PencilIcon } from 'lucide-react';

import {
  OrderDistributionLabel,
  type OrderDistributionLabelLine,
} from '@/components/shared/order-distribution-label';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  exactDecimalTitle,
  formatDecimalDisplay,
  formatMoneyDisplay,
} from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import { isReadOnly, type OrderDraftTotals, type OrderLineDraft } from './order-line-draft';
import { OrderStatusBadge } from './order-status-badge';
import type { OrderDistributionLine } from './use-order-distribution-availability';

export const ORDER_LINES_TABLE_TESTID = 'order-lines-table';
export const ORDER_LINES_CARDS_TESTID = 'order-lines-cards';
export const ORDER_LINES_ROW_TESTID = 'order-lines-row';
export const ORDER_LINES_CARD_TESTID = 'order-lines-card';
export const ORDER_LINES_EDIT_TESTID = 'order-lines-edit';
export const ORDER_LINES_READ_ONLY_TESTID = 'order-lines-read-only';
export const ORDER_LINES_EMPTY_TESTID = 'order-lines-empty';
export const ORDER_LINES_TOTALS_TESTID = 'order-lines-totals';
export const ORDER_LINES_TOTAL_TESTID = 'order-lines-total';
export const ORDER_LINES_WITHOUT_PRICE_TESTID = 'order-lines-without-price';
export const ORDER_LINES_COST_TESTID = 'order-lines-cost';

export type OrderLinesTableTexts = {
  readonly recipe: string;
  readonly quantity: string;
  readonly price: string;
  readonly status: string;
  readonly actions: string;
  readonly withoutPriceCell: string;
  readonly readOnly: string;
  readonly edit: (recipeName: string) => string;
  readonly editCard: string;
  readonly marked: string;
  readonly empty: string;
  readonly total: string;
  readonly withoutPrice: (count: number) => string;
  readonly cost: string;
  readonly missing: string;
};

export const ORDER_LINES_TABLE_TEXTS: OrderLinesTableTexts = {
  recipe: 'Receta',
  quantity: 'Cantidad',
  price: 'Precio',
  status: 'Estado',
  actions: 'Acciones',
  withoutPriceCell: 'Sin precio',
  readOnly: 'Solo lectura',
  edit: (recipeName) => `Editar ${recipeName}`,
  editCard: 'Editar receta',
  marked: 'Con error',
  empty: 'El pedido aún no tiene recetas. Añade al menos una.',
  total: 'Total',
  withoutPrice: (count) => `${count} sin precio`,
  cost: 'Costo estimado',
  missing: 'Sin dato',
};

export type OrderLinesTableProps = {
  /** En el orden del pedido, canceladas incluidas. */
  readonly lines: readonly OrderLineDraft[];
  /** Las recetas que el último guardado señaló, por su `key`. */
  readonly markedKeys?: ReadonlySet<string>;
  readonly onEdit: (key: string) => void;
  readonly texts?: OrderLinesTableTexts;
};

function labelLine(line: OrderDistributionLine): OrderDistributionLabelLine {
  return {
    presentationName: line.presentationName,
    packagingName: line.packagingName ?? null,
    packages: Number(line.packages),
  };
}

function quantityText(line: OrderLineDraft): string {
  const quantity = formatDecimalDisplay(line.quantity);
  return line.unitLabel === null ? quantity : `${quantity} ${line.unitLabel}`;
}

function Price({ value, texts }: { readonly value: string; readonly texts: OrderLinesTableTexts }) {
  if (value.trim() === '') return <span className="text-muted-foreground">{texts.withoutPriceCell}</span>;
  return (
    <span className="font-mono tabular-nums" title={exactDecimalTitle(value)}>
      {formatMoneyDisplay(value)}
    </span>
  );
}

function Status({ line }: { readonly line: OrderLineDraft }) {
  return <OrderStatusBadge status={line.saved?.status ?? 'PENDIENTE'} />;
}

const MARKED_CLASS = 'bg-destructive-subtle shadow-[inset_3px_0_0_var(--destructive)]';

function Name({
  line,
  marked,
  texts,
}: {
  readonly line: OrderLineDraft;
  readonly marked: boolean;
  readonly texts: OrderLinesTableTexts;
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">
        {line.recipe.name}
        {marked ? <span className="sr-only"> ({texts.marked})</span> : null}
      </span>
      <span className="text-xs text-muted-foreground">
        <OrderDistributionLabel lines={line.presentationLines.map(labelLine)} />
      </span>
    </span>
  );
}

type RowProps = {
  readonly line: OrderLineDraft;
  readonly marked: boolean;
  readonly onEdit: (key: string) => void;
  readonly texts: OrderLinesTableTexts;
};

function ReadOnlyMark({ texts }: { readonly texts: OrderLinesTableTexts }) {
  return (
    <span className="text-xs text-muted-foreground" data-testid={ORDER_LINES_READ_ONLY_TESTID}>
      {texts.readOnly}
    </span>
  );
}

function LineCard({ line, marked, onEdit, texts }: RowProps) {
  return (
    <li
      data-testid={ORDER_LINES_CARD_TESTID}
      data-line-key={line.key}
      data-marked={marked ? 'true' : undefined}
      className={cn('flex flex-col gap-2 rounded-lg border bg-card p-3', marked && MARKED_CLASS)}
    >
      <div className="flex items-start justify-between gap-2">
        <Name line={line} marked={marked} texts={texts} />
        <Status line={line} />
      </div>
      <div className="flex flex-wrap gap-3 text-[13px]">
        <span className="font-mono tabular-nums">{quantityText(line)}</span>
        <Price value={line.salePrice} texts={texts} />
      </div>
      {isReadOnly(line) ? (
        <ReadOnlyMark texts={texts} />
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn(touchTarget, 'self-start')}
          aria-label={texts.edit(line.recipe.name)}
          onClick={() => onEdit(line.key)}
          data-testid={ORDER_LINES_EDIT_TESTID}
        >
          {texts.editCard}
        </Button>
      )}
    </li>
  );
}

function LineRow({ line, marked, onEdit, texts }: RowProps) {
  return (
    <TableRow
      data-testid={ORDER_LINES_ROW_TESTID}
      data-line-key={line.key}
      data-marked={marked ? 'true' : undefined}
      className={cn(marked && MARKED_CLASS)}
    >
      <TableCell className="whitespace-normal">
        <Name line={line} marked={marked} texts={texts} />
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{quantityText(line)}</TableCell>
      <TableCell className="text-right">
        <Price value={line.salePrice} texts={texts} />
      </TableCell>
      <TableCell>
        <Status line={line} />
      </TableCell>
      <TableCell className="text-right">
        {isReadOnly(line) ? (
          <ReadOnlyMark texts={texts} />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={touchTarget}
            aria-label={texts.edit(line.recipe.name)}
            onClick={() => onEdit(line.key)}
            data-testid={ORDER_LINES_EDIT_TESTID}
          >
            <PencilIcon aria-hidden="true" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/**
 * Tabla de recetas del panel del pedido; en el teléfono, una tarjeta por receta. Las dos formas
 * van en el DOM y el ancho decide cuál se ve, sin esperar a medir la pantalla.
 */
export function OrderLinesTable({
  lines,
  markedKeys = new Set(),
  onEdit,
  texts = ORDER_LINES_TABLE_TEXTS,
}: OrderLinesTableProps) {
  if (lines.length === 0) return null;

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden" data-testid={ORDER_LINES_CARDS_TESTID}>
        {lines.map((line) => (
          <LineCard key={line.key} line={line} marked={markedKeys.has(line.key)} onEdit={onEdit} texts={texts} />
        ))}
      </ul>
      <div className="hidden rounded-lg border md:block">
        <Table data-testid={ORDER_LINES_TABLE_TESTID}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{texts.recipe}</TableHead>
              <TableHead scope="col" className="text-right">
                {texts.quantity}
              </TableHead>
              <TableHead scope="col" className="text-right">
                {texts.price}
              </TableHead>
              <TableHead scope="col">{texts.status}</TableHead>
              <TableHead scope="col">
                <span className="sr-only">{texts.actions}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <LineRow key={line.key} line={line} marked={markedKeys.has(line.key)} onEdit={onEdit} texts={texts} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export type OrderLinesEmptyProps = { readonly texts?: OrderLinesTableTexts };

export function OrderLinesEmpty({ texts = ORDER_LINES_TABLE_TEXTS }: OrderLinesEmptyProps) {
  return (
    <p
      className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
      data-testid={ORDER_LINES_EMPTY_TESTID}
    >
      {texts.empty}
    </p>
  );
}

export type OrderLinesTotalsProps = {
  readonly totals: OrderDraftTotals;
  readonly texts?: OrderLinesTableTexts;
};

function TotalAmount({ value, testId, texts }: {
  readonly value: string | null;
  readonly testId: string;
  readonly texts: OrderLinesTableTexts;
}) {
  if (value === null) {
    return (
      <span aria-label={texts.missing} data-testid={testId}>
        {EMPTY_MARK}
      </span>
    );
  }
  return (
    <span className="font-mono tabular-nums" title={exactDecimalTitle(value)} data-testid={testId}>
      {formatMoneyDisplay(value)}
    </span>
  );
}

/** Total del precio y coste estimado de las recetas no canceladas del borrador. */
export function OrderLinesTotals({ totals, texts = ORDER_LINES_TABLE_TEXTS }: OrderLinesTotalsProps) {
  return (
    <dl className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm" data-testid={ORDER_LINES_TOTALS_TESTID}>
      <div className="flex items-baseline justify-between gap-3">
        <dt>
          {texts.total}
          {totals.linesWithoutPrice > 0 ? (
            <span className="ml-1.5 text-xs text-muted-foreground" data-testid={ORDER_LINES_WITHOUT_PRICE_TESTID}>
              {texts.withoutPrice(totals.linesWithoutPrice)}
            </span>
          ) : null}
        </dt>
        <dd className="font-medium">
          <TotalAmount value={totals.salePriceTotal} testId={ORDER_LINES_TOTAL_TESTID} texts={texts} />
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">{texts.cost}</dt>
        <dd>
          <TotalAmount value={totals.ingredientsCostTotal} testId={ORDER_LINES_COST_TESTID} texts={texts} />
        </dd>
      </div>
    </dl>
  );
}
