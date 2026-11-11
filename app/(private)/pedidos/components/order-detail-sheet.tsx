'use client';

import type { ReactNode } from 'react';

import { OrderDistributionLabel } from '@/components/shared/order-distribution-label';
import { orderCustomerLabel } from '@/components/shared/order-customer-label';
import { OrderProgress } from '@/components/shared/order-progress';
import { ResponsibleAvatars } from '@/components/shared/responsible-avatars';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { OrderResponsible } from '@/lib/modules/asignaciones';
import type { OrderLineView, OrderSummary } from '@/lib/modules/pedidos';
import {
  exactDecimalTitle,
  formatDecimalDisplay,
  formatMoneyDisplay,
} from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { canEditOrder } from './order-line-actions';
import { OrderProducedPresentations } from './order-produced-presentations';
import { distributionLabelLine } from './order-responsibles-sheet';
import { OrderPriorityBadge, OrderStatusBadge } from './order-status-badge';

export const ORDER_DETAIL_SHEET_TESTID = 'order-detail-sheet';
export const ORDER_DETAIL_SUMMARY_TESTID = 'order-detail-summary';
export const ORDER_DETAIL_LINE_TESTID = 'order-detail-line';
export const ORDER_DETAIL_EDIT_TESTID = 'order-detail-edit';

export type OrderDetailTexts = {
  readonly title: (numberText: string) => string;
  readonly description: (customer: string, requestedAt: string) => string;
  readonly summary: string;
  readonly progress: string;
  readonly salePrice: string;
  readonly withoutPrice: (count: number) => string;
  readonly ingredientsCost: string;
  readonly actualCost: string;
  readonly responsibles: string;
  readonly lines: string;
  readonly quantity: string;
  readonly distribution: string;
  readonly linePrice: string;
  readonly cancellationReason: (reason: string) => string;
  readonly missing: string;
  readonly close: string;
  readonly edit: string;
};

export const ORDER_DETAIL_TEXTS: OrderDetailTexts = {
  title: (numberText) => `Pedido ${numberText}`,
  description: (customer, requestedAt) => `${customer} · solicitado el ${requestedAt}`,
  summary: 'Resumen del pedido',
  progress: 'Avance',
  salePrice: 'Precio de venta',
  withoutPrice: (count) => `${count} sin precio`,
  ingredientsCost: 'Costo estimado',
  actualCost: 'Costo real',
  responsibles: 'Responsables',
  lines: 'Recetas',
  quantity: 'Cantidad',
  distribution: 'Reparto',
  linePrice: 'Precio',
  cancellationReason: (reason) => `Motivo de cancelación: ${reason}`,
  missing: 'Sin dato',
  close: 'Cerrar',
  edit: 'Editar',
};

const PRODUCED_LINE_STATUSES: ReadonlySet<OrderLineView['status']> = new Set([
  'TERMINADO',
  'ENTREGADO',
]);

export type OrderDetailSheetProps = {
  readonly order: OrderSummary;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Los responsables de este pedido, del lote que la sección ya pidió. */
  readonly responsibles: readonly OrderResponsible[];
  /** `presentationId` → `productId` de este pedido; sin valor, el reparto sin enlaces. */
  readonly producedProducts?: Readonly<Record<string, string>>;
  readonly onEdit: () => void;
  readonly texts?: OrderDetailTexts;
};

/** UTC y no el local del entorno: el servidor y el navegador no comparten huso. */
function formatRequestDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function Missing({ label }: { readonly label: string }) {
  return <span aria-label={label}>{EMPTY_MARK}</span>;
}

function Amount({ value, missing }: { readonly value: string | null; readonly missing: string }) {
  if (value === null) return <Missing label={missing} />;
  return (
    <span className="font-mono tabular-nums" title={exactDecimalTitle(value)}>
      {formatMoneyDisplay(value)}
    </span>
  );
}

function Field({ term, children }: { readonly term: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function quantityText(line: OrderLineView): string {
  const quantity = formatDecimalDisplay(line.quantity);
  return line.unitLabel === null ? quantity : `${quantity} ${line.unitLabel}`;
}

function LineDistribution({
  line,
  producedProducts,
}: {
  readonly line: OrderLineView;
  readonly producedProducts: Readonly<Record<string, string>> | undefined;
}) {
  const produced =
    PRODUCED_LINE_STATUSES.has(line.status) &&
    producedProducts !== undefined &&
    Object.keys(producedProducts).length > 0;
  if (produced) {
    return (
      <OrderProducedPresentations
        lines={line.presentationLines}
        productByPresentation={producedProducts}
      />
    );
  }
  return <OrderDistributionLabel lines={line.presentationLines.map(distributionLabelLine)} />;
}

function LineCard({
  line,
  producedProducts,
  texts,
}: {
  readonly line: OrderLineView;
  readonly producedProducts: Readonly<Record<string, string>> | undefined;
  readonly texts: OrderDetailTexts;
}) {
  const nameId = `order-detail-line-${line.id}`;
  return (
    <li>
      <section
        aria-labelledby={nameId}
        data-testid={ORDER_DETAIL_LINE_TESTID}
        data-line-id={line.id}
        className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3.5"
      >
        <div className="flex items-center justify-between gap-3">
          <h4 id={nameId} className="font-medium">
            {line.recipeName ?? <Missing label={texts.missing} />}
          </h4>
          <OrderStatusBadge status={line.status} />
        </div>
        <dl className="flex flex-col gap-1 text-[13px]">
          <Field term={texts.quantity}>
            <span className="font-mono tabular-nums">{quantityText(line)}</span>
          </Field>
          <Field term={texts.distribution}>
            <LineDistribution line={line} producedProducts={producedProducts} />
          </Field>
          <Field term={texts.linePrice}>
            <Amount value={line.salePrice} missing={texts.missing} />
          </Field>
          <Field term={texts.ingredientsCost}>
            <Amount value={line.ingredientsCost} missing={texts.missing} />
          </Field>
          <Field term={texts.actualCost}>
            <Amount value={line.actualCost} missing={texts.missing} />
          </Field>
        </dl>
        {line.status === 'CANCELADO' && line.cancellationReason !== null ? (
          <p className="text-[13px] text-muted-foreground">
            {texts.cancellationReason(line.cancellationReason)}
          </p>
        ) : null}
      </section>
    </li>
  );
}

/** Detalle de solo lectura de un pedido, con una tarjeta por receta. */
export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  responsibles,
  producedProducts,
  onEdit,
  texts = ORDER_DETAIL_TEXTS,
}: OrderDetailSheetProps) {
  const customer = order.customer === null ? EMPTY_MARK : orderCustomerLabel(order.customer);
  const summaryId = `order-detail-summary-${order.id}`;
  const linesId = `order-detail-lines-${order.id}`;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      disableEscapeDismissal={false}
      disablePointerDismissal={false}
    >
      <SheetContent
        side="right"
        className="w-full pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full sm:max-w-lg"
        data-testid={ORDER_DETAIL_SHEET_TESTID}
        data-order-id={order.id}
        footer={
          <>
            <SheetClose render={<Button type="button" variant="outline" touch="mobile" />}>
              {texts.close}
            </SheetClose>
            <Button
              type="button"
              touch="mobile"
              disabled={!canEditOrder(order)}
              onClick={onEdit}
              data-testid={ORDER_DETAIL_EDIT_TESTID}
            >
              {texts.edit}
            </Button>
          </>
        }
      >
        <SheetHeader>
          <SheetTitle>
            {texts.title(order.numberText)}
          </SheetTitle>
          <SheetDescription>
            {texts.description(customer, formatRequestDate(order.createdAt))}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <section
            aria-labelledby={summaryId}
            data-testid={ORDER_DETAIL_SUMMARY_TESTID}
            className="flex flex-col gap-3 rounded-lg border bg-card p-4"
          >
            <h3 id={summaryId} className="sr-only">
              {texts.summary}
            </h3>
            <div className="flex items-center justify-between gap-3">
              <OrderStatusBadge status={order.status} />
              <OrderPriorityBadge priority={order.priority} />
            </div>
            <OrderProgress progress={order.progress} variant="long" label={texts.progress} />
            <dl className="flex flex-col gap-1 text-[13px]">
              <Field term={texts.salePrice}>
                <Amount value={order.salePriceTotal} missing={texts.missing} />
                {order.linesWithoutPrice > 0 ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {texts.withoutPrice(order.linesWithoutPrice)}
                  </span>
                ) : null}
              </Field>
              <Field term={texts.ingredientsCost}>
                <Amount value={order.ingredientsCostTotal} missing={texts.missing} />
              </Field>
              <Field term={texts.actualCost}>
                <Amount value={order.actualCostTotal} missing={texts.missing} />
              </Field>
              <Field term={texts.responsibles}>
                <span className="inline-flex justify-end">
                  <ResponsibleAvatars responsibles={responsibles} />
                </span>
              </Field>
            </dl>
          </section>

          <section aria-labelledby={linesId} className="flex flex-col gap-2 pb-4">
            <h3 id={linesId} className="text-sm font-medium">
              {texts.lines}
            </h3>
            <ul className="flex flex-col gap-2">
              {order.lines.map((line) => (
                <LineCard
                  key={line.id}
                  line={line}
                  producedProducts={producedProducts}
                  texts={texts}
                />
              ))}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
