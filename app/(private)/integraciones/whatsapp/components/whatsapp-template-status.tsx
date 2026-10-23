'use client';

import { useState } from 'react';

import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { WhatsappTemplateView } from '@/lib/modules/integraciones';

import { statusBadgeOf } from './whatsapp-template-rules';

export const WHATSAPP_TEMPLATE_STATUS_TESTID = 'whatsapp-template-status';
export const WHATSAPP_TEMPLATE_REASON_BUTTON_TESTID = 'whatsapp-template-reason-button';
export const WHATSAPP_TEMPLATE_REASON_TEXT_TESTID = 'whatsapp-template-reason-text';
export const WHATSAPP_TEMPLATE_REASON_POPOVER_TESTID = 'whatsapp-template-reason-popover';

export const WHATSAPP_TEMPLATE_STATUS_TEXTS = {
  reasonLabel: (reason: string) => `Motivo del rechazo: ${reason}`,
  reasonTitle: 'Motivo del rechazo',
  reasonMark: '!',
} as const;

function rejectedReasonOf(template: WhatsappTemplateView): string | null {
  if (template.status !== 'REJECTED') return null;
  const reason = template.rejectedReason?.trim() ?? '';
  return reason === '' ? null : reason;
}

/**
 * El globo (Tooltip) abre con puntero y con foco, pero no al tocar en pantallas táctiles: por eso el
 * mismo «!» abre además un Popover al pulsarlo (toque, clic, Enter o Espacio), y mientras está
 * abierto el globo se desactiva para no enseñar el motivo dos veces.
 */
function RejectedReasonButton({ reason }: { readonly reason: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip disabled={open}>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  touch
                  aria-label={WHATSAPP_TEMPLATE_STATUS_TEXTS.reasonLabel(reason)}
                  data-testid={WHATSAPP_TEMPLATE_REASON_BUTTON_TESTID}
                  className="font-bold text-destructive-text"
                />
              }
            />
          }
        >
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full bg-destructive-subtle text-xs"
          >
            {WHATSAPP_TEMPLATE_STATUS_TEXTS.reasonMark}
          </span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        aria-label={WHATSAPP_TEMPLATE_STATUS_TEXTS.reasonTitle}
        data-testid={WHATSAPP_TEMPLATE_REASON_POPOVER_TESTID}
        className="w-fit max-w-xs whitespace-normal"
      >
        {reason}
      </PopoverContent>
    </Popover>
  );
}

/**
 * La misma celda se pinta en la tabla y en la tarjeta: en la tabla el motivo va en el globo o el
 * Popover del «!» y en la tarjeta como texto.
 */
export function WhatsappTemplateStatus({ template }: { readonly template: WhatsappTemplateView }) {
  const badge = statusBadgeOf(template);
  const reason = rejectedReasonOf(template);

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1">
        <StatusBadge tone={badge.tone} label={badge.label} data-testid={WHATSAPP_TEMPLATE_STATUS_TESTID} />
        {reason === null ? null : (
          <span className="@max-[760px]:hidden">
            <RejectedReasonButton reason={reason} />
          </span>
        )}
      </span>
      {reason === null ? null : (
        <span
          className="hidden items-start gap-1.5 text-[13px] whitespace-normal text-destructive-text @max-[760px]:flex"
          data-testid={WHATSAPP_TEMPLATE_REASON_TEXT_TESTID}
        >
          <span aria-hidden="true" className="font-bold">
            {WHATSAPP_TEMPLATE_STATUS_TEXTS.reasonMark}
          </span>
          {reason}
        </span>
      )}
    </span>
  );
}
