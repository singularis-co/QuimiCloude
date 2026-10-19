import { StatusBadge, type StatusTone } from '@/components/shared/status-badge';
import type { WaitingOrder } from '@/lib/modules/pedidos';

export const DIRECT_DELIVERY_SURPLUS_TESTID = 'direct-delivery-surplus';
export const DIRECT_DELIVERY_COUNTER_TESTID = 'direct-delivery-counter';
export const DIRECT_DELIVERY_COUNTER_TAG_TESTID = 'direct-delivery-counter-tag';
export const DIRECT_DELIVERY_WAITING_TESTID = 'direct-delivery-waiting';
export const DIRECT_DELIVERY_WAITING_ORDER_TESTID = 'direct-delivery-waiting-order';

export type DirectDeliverySurplusCardLabels = {
  readonly title: string;
  readonly inStock: string;
  readonly waiting: string;
  readonly surplus: string;
  readonly packagesUnit: string;
  readonly waitingToggle: string;
  readonly waitingOrder: (numberText: string, missingPackages: number) => string;
  readonly written: string;
  readonly of: string;
  readonly noPackages: string;
  readonly left: (packages: number) => string;
  readonly exceeds: (packages: number) => string;
};

export const DIRECT_DELIVERY_SURPLUS_CARD_LABELS: DirectDeliverySurplusCardLabels = {
  title: 'Excedente',
  inStock: 'En stock',
  waiting: 'Esperan pedidos terminados',
  surplus: 'Se puede entregar',
  packagesUnit: 'envases',
  waitingToggle: 'Ver los pedidos que esperan',
  waitingOrder: (numberText, missingPackages) => `Pedido ${numberText} · faltan ${missingPackages} envases`,
  written: 'Entregas',
  of: 'de',
  noPackages: 'Sin envases',
  left: (packages) => `Quedan ${packages} libres`,
  exceeds: (packages) => `Sobran ${packages}`,
};

export type DirectDeliverySurplusCardProps = {
  readonly stockPackages: number;
  readonly waitingPackages: number;
  readonly surplusPackages: number;
  readonly waiting: readonly WaitingOrder[];
  /** Suma de los envases escritos en todos los bloques. */
  readonly writtenPackages: number;
  readonly labels?: DirectDeliverySurplusCardLabels;
};

function counterTag(
  written: number,
  surplus: number,
  labels: DirectDeliverySurplusCardLabels,
): { readonly tone: StatusTone; readonly label: string } {
  if (written === 0) return { tone: 'muted', label: labels.noPackages };
  if (written <= surplus) return { tone: 'success', label: labels.left(surplus - written) };
  return { tone: 'danger', label: labels.exceeds(written - surplus) };
}

/** Lo que hay en stock, lo que esperan los pedidos terminados y cuanto llevan escrito los clientes. */
export function DirectDeliverySurplusCard({
  stockPackages,
  waitingPackages,
  surplusPackages,
  waiting,
  writtenPackages,
  labels = DIRECT_DELIVERY_SURPLUS_CARD_LABELS,
}: DirectDeliverySurplusCardProps) {
  const tag = counterTag(writtenPackages, surplusPackages, labels);
  return (
    <section
      className="flex flex-col gap-2.5 rounded-lg border p-4"
      aria-label={labels.title}
      data-testid={DIRECT_DELIVERY_SURPLUS_TESTID}
    >
      <h3 className="text-base font-semibold">{labels.title}</h3>
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">{labels.inStock}</dt>
        <dd className="m-0 text-right" data-field="stock">
          <span className="font-mono tabular-nums">{stockPackages}</span> {labels.packagesUnit}
        </dd>
        <dt className="text-muted-foreground">{labels.waiting}</dt>
        <dd className="m-0 text-right" data-field="waiting">
          <span className="font-mono tabular-nums">{`−${waitingPackages}`}</span> {labels.packagesUnit}
        </dd>
        <dt className="border-t pt-1.5 font-semibold">{labels.surplus}</dt>
        <dd className="m-0 border-t pt-1.5 text-right font-semibold" data-field="surplus">
          <span className="font-mono tabular-nums">{surplusPackages}</span> {labels.packagesUnit}
        </dd>
      </dl>
      <details className="text-sm" data-testid={DIRECT_DELIVERY_WAITING_TESTID}>
        <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground">
          {labels.waitingToggle}
        </summary>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
          {waiting.map((order) => (
            <li key={order.orderId} data-testid={DIRECT_DELIVERY_WAITING_ORDER_TESTID} data-order-id={order.orderId}>
              {labels.waitingOrder(order.numberText, order.missingPackages)}
            </li>
          ))}
        </ul>
      </details>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-t pt-2.5 text-sm"
        data-testid={DIRECT_DELIVERY_COUNTER_TESTID}
        aria-live="polite"
      >
        <span>
          <span className="text-muted-foreground">{labels.written} </span>
          <span className="font-mono font-semibold tabular-nums">{writtenPackages}</span>
          <span className="text-muted-foreground"> {labels.of} </span>
          <span className="font-mono tabular-nums">{surplusPackages}</span>
        </span>
        <StatusBadge tone={tag.tone} label={tag.label} data-testid={DIRECT_DELIVERY_COUNTER_TAG_TESTID} />
      </div>
    </section>
  );
}
