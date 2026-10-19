'use client';

import Link from 'next/link';

import {
  OrderDistributionLabel,
  orderDistributionLineText,
} from '@/components/shared/order-distribution-label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { OrderPresentationLineView } from '@/lib/modules/pedidos';
import { finishedProductDetailRoute } from '@/lib/shared/routes';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

/** `orderId` → `presentationId` → `productId`: plano para que cruce del servidor al cliente. */
export type ProducedProductsByOrder = Readonly<Record<string, Readonly<Record<string, string>>>>;

export const ORDER_PRODUCED_PRESENTATIONS_TESTID = 'order-produced-presentations';
export const ORDER_PRODUCED_PRODUCT_LINK_TESTID = 'order-produced-product-link';
export const ORDER_PRODUCED_MORE_TESTID = 'order-produced-more';
export const ORDER_PRODUCED_LIST_TESTID = 'order-produced-list';

export type OrderProducedPresentationsTexts = {
  /** Nombre accesible del «+N»; empieza por el texto visible para que la voz lo encuentre. */
  readonly more: (hidden: number, total: number) => string;
};

const DEFAULT_TEXTS: OrderProducedPresentationsTexts = {
  more: (hidden, total) => `+${hidden}, ver las ${total} presentaciones`,
};

const LINK_CLASS =
  'inline-flex max-w-full items-center rounded-lg font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none';

export type OrderProducedPresentationsProps = {
  /** En orden de alta, como en `OrderDistributionLabel`. */
  readonly lines: readonly OrderPresentationLineView[];
  /** `presentationId` → `productId` de este pedido. */
  readonly productByPresentation: Readonly<Record<string, string>>;
  readonly texts?: OrderProducedPresentationsTexts;
};

function lineText(line: OrderPresentationLineView): string {
  return orderDistributionLineText({
    presentationName: line.presentationName,
    packagingName: line.packagingName,
    packages: line.packages,
    presentationContent: line.presentationContent,
    presentationUnitLabel: line.presentationUnitLabel,
  });
}

function ProducedLine({
  line,
  productId,
}: {
  readonly line: OrderPresentationLineView;
  readonly productId: string | undefined;
}) {
  const text = lineText(line);
  if (productId === undefined) return <span>{text}</span>;

  return (
    <Link
      href={finishedProductDetailRoute(productId)}
      data-testid={ORDER_PRODUCED_PRODUCT_LINK_TESTID}
      data-presentation-id={line.presentationId}
      className={cn(LINK_CLASS, touchTarget)}
    >
      {text}
    </Link>
  );
}

/** El reparto de un pedido producido, con cada presentación enlazada a su producto terminado. */
export function OrderProducedPresentations({
  lines,
  productByPresentation,
  texts = DEFAULT_TEXTS,
}: OrderProducedPresentationsProps) {
  const [first, ...rest] = lines;
  if (first === undefined) return <OrderDistributionLabel lines={[]} />;

  return (
    <span
      data-testid={ORDER_PRODUCED_PRESENTATIONS_TESTID}
      title={lines.map(lineText).join(', ')}
      className="inline-flex items-center gap-1"
    >
      <ProducedLine line={first} productId={productByPresentation[first.presentationId]} />
      {rest.length > 0 ? (
        <Popover>
          <PopoverTrigger
            render={<Button type="button" variant="ghost" size="sm" touch />}
            aria-label={texts.more(rest.length, lines.length)}
            data-testid={ORDER_PRODUCED_MORE_TESTID}
          >
            {`+${rest.length}`}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <ul data-testid={ORDER_PRODUCED_LIST_TESTID} className="flex flex-col gap-1">
              {lines.map((line, index) => (
                <li key={`${line.presentationId}-${index}`}>
                  <ProducedLine
                    line={line}
                    productId={productByPresentation[line.presentationId]}
                  />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  );
}
