import type { ReactNode } from 'react';

import { StatusBadge } from '@/components/shared/status-badge';
import { cn } from '@/lib/utils';

import type { ChatOrderView } from './chat-view';
import { CHAT_ORDER_DETAIL_TESTID, CHAT_ORDER_DETAIL_TEXT } from './contact-texts';

export type ChatOrderDetailProps = {
  readonly order: ChatOrderView;
  readonly className?: string;
};

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const CELL = 'py-1.5 text-right font-mono tabular-nums';

export function ChatOrderDetail({ order, className }: ChatOrderDetailProps) {
  return (
    <div data-testid={CHAT_ORDER_DETAIL_TESTID} className={cn('flex flex-col gap-3 px-4 pt-3 pb-3.5 md:px-5', className)}>
      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <Field label={CHAT_ORDER_DETAIL_TEXT.number}>
          <span className="font-mono font-semibold">{order.number}</span>
        </Field>
        <Field label={CHAT_ORDER_DETAIL_TEXT.status}>
          <StatusBadge tone="info" label={order.statusLabel} />
        </Field>
        {order.productName !== null && <Field label={CHAT_ORDER_DETAIL_TEXT.product}>{order.productName}</Field>}
        {order.totalLabel !== null && (
          <Field label={CHAT_ORDER_DETAIL_TEXT.total}>
            <span className="font-semibold">{order.totalLabel}</span>
          </Field>
        )}
      </dl>
      {order.lines.length > 0 && (
        <table className="w-full text-[13px]">
          <caption className="pb-1 text-left text-xs text-muted-foreground">{CHAT_ORDER_DETAIL_TEXT.lines}</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="py-1 text-left font-normal">
                {CHAT_ORDER_DETAIL_TEXT.ordered}
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                {CHAT_ORDER_DETAIL_TEXT.delivered}
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                {CHAT_ORDER_DETAIL_TEXT.pending}
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.key} className="border-t">
                <td className="py-1.5 pr-3 [overflow-wrap:anywhere]">{line.ordered}</td>
                <td className={CELL}>{line.delivered}</td>
                <td className={cn(CELL, 'font-semibold', line.pending > 0 ? 'text-warning-text' : 'text-success-text')}>
                  {line.pending}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
