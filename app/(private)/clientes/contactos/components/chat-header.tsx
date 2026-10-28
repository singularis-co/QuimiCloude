'use client';

import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useId } from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { SharedSelectControl } from '@/components/shared/shared-select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { WhatsappChat } from '@/lib/modules/integraciones';
import type { ErrorState } from '@/lib/modules/errores';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';
import { getInitials } from '@/lib/shared/ui/initials';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import { ChatOrderDetail } from './chat-order-detail';
import type { ChatContextView } from './chat-view';
import { ChatWindowBadge } from './chat-window-badge';
import {
  CHAT_HEADER_TESTID,
  CHAT_HEADER_TEXT,
  CHAT_ORDER_ERROR_TESTID,
  CHAT_ORDER_SELECT_TESTID,
} from './contact-texts';

export type ChatHeaderProps = {
  readonly customerName: string;
  readonly phone: string;
  readonly window: WhatsappChat['window'];
  /** `null` mientras no ha llegado el contexto del chat. */
  readonly context: ChatContextView | null;
  /** Hay una petición de contexto en curso; el selector no deja elegir. */
  readonly contextLoading: boolean;
  /** Error del último cambio de pedido. */
  readonly orderError: ErrorState | null;
  readonly onSelectOrder: (orderId: string) => void;
  readonly onBack: () => void;
};

export function ChatHeader({
  customerName,
  phone,
  window: chatWindow,
  context,
  contextLoading,
  orderError,
  onSelectOrder,
  onBack,
}: ChatHeaderProps) {
  const baseId = useId();
  const labelId = `${baseId}-order-label`;
  const errorId = `${baseId}-order-error`;
  const detailId = `${baseId}-order-detail`;

  const orders = context?.orders ?? [];
  const selectedOrder = orders.find((order) => order.id === context?.selectedOrderId) ?? orders[0] ?? null;
  const showSelector = orders.length > 1;

  return (
    <Collapsible className="border-b bg-card" data-testid={CHAT_HEADER_TESTID}>
      <header className="flex flex-wrap items-center gap-x-3 md:px-5 md:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pr-3 pl-1 md:gap-3 md:p-0">
          <Button type="button" variant="ghost" size="icon" touch aria-label={CHAT_HEADER_TEXT.back} onClick={onBack} className="md:hidden">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Button>
          <Avatar size="lg" tone={avatarTone(phone)} className="hidden md:flex" aria-hidden="true">
            <AvatarFallback className="font-semibold">{getInitials(customerName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">{customerName}</span>
            <span className="font-mono text-xs text-muted-foreground">{phone}</span>
          </div>
        </div>

        {selectedOrder !== null && (
          <div className="flex flex-col gap-1 max-md:w-full max-md:px-3 max-md:pb-2">
            <div className="flex items-center gap-2">
              {showSelector && (
                <>
                  <span id={labelId} className="text-[13px] text-muted-foreground">
                    {CHAT_HEADER_TEXT.orderLabel}
                  </span>
                  <SharedSelectControl
                    name="orderId"
                    options={orders.map((order) => ({ value: order.id, label: order.number }))}
                    value={selectedOrder.id}
                    onValueChange={(value) => {
                      if (value !== null && value !== selectedOrder.id) onSelectOrder(value);
                    }}
                    disabled={contextLoading}
                    busy={contextLoading}
                    labelledBy={labelId}
                    describedBy={orderError === null ? undefined : errorId}
                    invalid={orderError !== null}
                    triggerTestId={CHAT_ORDER_SELECT_TESTID}
                    triggerClassName={cn(touchTarget, 'w-auto min-w-36 text-base md:text-sm')}
                    alignItemWithTrigger={false}
                  />
                </>
              )}
              <CollapsibleTrigger
                aria-label={CHAT_HEADER_TEXT.orderDetailsToggle}
                render={<Button type="button" variant="outline" size="icon" touch className="group/toggle ml-auto md:ml-0" />}
              >
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 transition-transform duration-150 group-aria-expanded/toggle:rotate-180 motion-reduce:transition-none"
                />
              </CollapsibleTrigger>
            </div>
            {orderError !== null && (
              <ErrorAlert
                error={orderError}
                id={errorId}
                testId={CHAT_ORDER_ERROR_TESTID}
                className="max-w-xs text-xs text-destructive-text"
              />
            )}
          </div>
        )}

        <ChatWindowBadge
          window={chatWindow}
          className="order-last w-full max-md:border-x-0 max-md:border-b-0 max-md:py-1.5 md:order-none md:w-auto"
        />
      </header>

      {selectedOrder !== null && (
        <CollapsibleContent id={detailId} className="border-t">
          <ChatOrderDetail order={selectedOrder} />
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
