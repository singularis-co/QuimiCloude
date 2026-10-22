import type { ReactNode } from 'react';

import { StatusBadge, type StatusTone } from '@/components/shared/status-badge';

export const ORDER_DELIVERY_SUMMARY_TESTID = 'order-delivery-summary';
export const ORDER_DELIVERY_SUMMARY_LINE_TESTID = 'order-delivery-summary-line';
export const ORDER_DELIVERY_LINE_COMPLETE_TESTID = 'order-delivery-line-complete';
export const ORDER_DELIVERY_LINE_EXCEEDS_TESTID = 'order-delivery-line-exceeds';
export const ORDER_DELIVERY_LINE_MISSING_TESTID = 'order-delivery-line-missing';

export type OrderDeliverySummaryLine = {
  readonly presentationLineId: string;
  readonly presentationName: string;
  /** Envases escritos para esta presentacion, sumando todos los clientes. */
  readonly writtenPackages: number;
  readonly remainingPackages: number;
};

export type OrderDeliverySummaryLabels = {
  readonly title: string;
  /** Va delante de los envases escritos («Entregas»). */
  readonly written: string;
  /** Va entre los escritos y los que faltan («de»). */
  readonly of: string;
  readonly complete: string;
  readonly missing: (packages: number) => string;
  readonly exceeds: (packages: number) => string;
  readonly footnote: string;
};

export type OrderDeliverySummaryProps = {
  readonly lines: readonly OrderDeliverySummaryLine[];
  readonly labels: OrderDeliverySummaryLabels;
  /** Imagen del producto, al lado del título. */
  readonly image?: ReactNode;
};

type Mark = { readonly tone: StatusTone; readonly label: string; readonly testId: string };

function markFor(line: OrderDeliverySummaryLine, labels: OrderDeliverySummaryLabels): Mark {
  const difference = line.writtenPackages - line.remainingPackages;
  if (difference === 0) {
    return { tone: 'success', label: labels.complete, testId: ORDER_DELIVERY_LINE_COMPLETE_TESTID };
  }
  if (difference > 0) {
    return { tone: 'danger', label: labels.exceeds(difference), testId: ORDER_DELIVERY_LINE_EXCEEDS_TESTID };
  }
  return { tone: 'waiting', label: labels.missing(-difference), testId: ORDER_DELIVERY_LINE_MISSING_TESTID };
}

/** «Por entregar»: lo escrito entre todos los clientes frente a lo que falta, por presentacion. */
export function OrderDeliverySummary({ lines, labels, image }: OrderDeliverySummaryProps) {
  return (
    <section
      className="flex flex-col gap-2.5 rounded-lg border p-4"
      aria-label={labels.title}
      data-testid={ORDER_DELIVERY_SUMMARY_TESTID}
    >
      {image === undefined ? (
        <h3 className="text-base font-semibold">{labels.title}</h3>
      ) : (
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0">{image}</div>
          <h3 className="text-base font-semibold">{labels.title}</h3>
        </div>
      )}
      <ul className="flex flex-col gap-2.5">
        {lines.map((line) => {
          const mark = markFor(line, labels);
          return (
            <li
              key={line.presentationLineId}
              className="flex flex-wrap items-center justify-between gap-3 text-sm"
              data-testid={ORDER_DELIVERY_SUMMARY_LINE_TESTID}
              data-presentation-line-id={line.presentationLineId}
            >
              <span className="min-w-0 font-medium break-words">{line.presentationName}</span>
              <span className="flex items-center gap-2.5">
                <span>
                  <span className="text-muted-foreground">{labels.written} </span>
                  <span className="font-mono font-medium tabular-nums">{line.writtenPackages}</span>
                  <span className="text-muted-foreground"> {labels.of} </span>
                  <span className="font-mono tabular-nums">{line.remainingPackages}</span>
                </span>
                <StatusBadge tone={mark.tone} label={mark.label} data-testid={mark.testId} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{labels.footnote}</p>
    </section>
  );
}
