'use client';

import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { WhatsappChat } from '@/lib/modules/integraciones';
import { cn } from '@/lib/utils';

import { formatWindowStatus, windowRemaining } from './chat-time-format';
import { CHAT_WINDOW_BADGE_TESTID } from './contact-texts';

const MINUTE_MS = 60_000;

type ChatWindow = WhatsappChat['window'];

export type ChatWindowBadgeProps = {
  readonly window: ChatWindow;
  readonly className?: string;
};

// El texto redondea los minutos hacia arriba, así que solo cambia en `closesAt - k min`: se despierta
// justo ahí en vez de cada minuto fijo, y el último salto cae en `closesAt`.
function msUntilNextChange(closesAt: string, now: number): number | null {
  const left = Date.parse(closesAt) - now;
  if (left <= 0) return null;
  return left % MINUTE_MS || MINUTE_MS;
}

type WindowClock = { readonly now: Date; readonly closesAt: string | null };

function useNow(chatWindow: ChatWindow): Date {
  const closesAt = chatWindow.open ? chatWindow.closesAt : null;
  const [clock, setClock] = useState<WindowClock>(() => ({ now: new Date(), closesAt }));

  useEffect(() => {
    if (closesAt === null) return undefined;
    // Con otra ventana, la hora guardada puede ser de hace horas: se refresca ya.
    const delay = clock.closesAt === closesAt ? msUntilNextChange(closesAt, Date.now()) : 0;
    if (delay === null) return undefined;
    const timer = setTimeout(() => setClock({ now: new Date(), closesAt }), delay);
    return () => clearTimeout(timer);
  }, [closesAt, clock]);

  return clock.now;
}

export function ChatWindowBadge({ window: chatWindow, className }: ChatWindowBadgeProps) {
  const now = useNow(chatWindow);
  const open = windowRemaining(chatWindow, now) !== null;

  return (
    <div
      data-testid={CHAT_WINDOW_BADGE_TESTID}
      data-open={open}
      className={cn(
        'flex items-center justify-center gap-1.5 border px-2.5 py-1 text-xs whitespace-nowrap md:rounded-full',
        open ? 'border-success-border bg-success-subtle text-success-text' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {open && <Clock aria-hidden="true" className="size-3.5 shrink-0" />}
      {/* La hora del servidor y la del navegador pueden caer en minutos distintos. */}
      <span suppressHydrationWarning>{formatWindowStatus(chatWindow, now)}</span>
    </div>
  );
}
