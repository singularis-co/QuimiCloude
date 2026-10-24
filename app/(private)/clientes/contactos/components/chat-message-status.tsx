import { Check, CheckCheck, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';

import { CHAT_DELIVERY_LABELS } from './contact-texts';
import type { ChatDelivery } from './chat-view';

export type ChatMessageStatusProps = {
  readonly delivery: Exclude<ChatDelivery, 'failed'>;
};

const ICON_BY_DELIVERY = {
  sending: Clock,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
} as const;

export function ChatMessageStatus({ delivery }: ChatMessageStatusProps) {
  const Icon = ICON_BY_DELIVERY[delivery];
  return (
    <span
      role="img"
      aria-label={CHAT_DELIVERY_LABELS[delivery]}
      data-delivery={delivery}
      className={cn('inline-flex', delivery === 'read' ? 'text-status-progress-dot' : 'text-muted-foreground')}
    >
      <Icon aria-hidden="true" className="size-3.5" />
    </span>
  );
}
