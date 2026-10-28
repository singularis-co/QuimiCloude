'use client';

import { Button } from '@/components/ui/button';
import type { WhatsappSendableTemplate } from '@/lib/modules/integraciones';
import { cn } from '@/lib/utils';

import { CHAT_TEMPLATE_CHIPS_TESTID, CHAT_TEMPLATE_CHIPS_TEXT } from './contact-texts';

export type ChatTemplateChipsProps = {
  readonly templates: readonly WhatsappSendableTemplate[];
  readonly selectedId: string | null;
  /** Recibe `null` al pulsar la burbuja ya marcada. */
  readonly onSelect: (templateId: string | null) => void;
  readonly disabled?: boolean;
};

export function ChatTemplateChips({ templates, selectedId, onSelect, disabled = false }: ChatTemplateChipsProps) {
  if (templates.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={CHAT_TEMPLATE_CHIPS_TEXT.groupLabel}
      data-testid={CHAT_TEMPLATE_CHIPS_TESTID}
      className="flex min-w-0 flex-wrap gap-2"
    >
      {templates.map((template) => {
        const pressed = template.id === selectedId;
        return (
          <Button
            key={template.id}
            type="button"
            variant="outline"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onSelect(pressed ? null : template.id)}
            className={cn(
              'relative h-auto max-w-full min-h-11 rounded-full px-3.5 py-1.5 text-left text-[13px] font-medium whitespace-normal [overflow-wrap:anywhere]',
              "md:min-h-8 md:py-1 md:after:absolute md:after:inset-x-0 md:after:-inset-y-1.5 md:after:content-['']",
              pressed && 'border-primary bg-primary/10 text-primary hover:bg-primary/15',
            )}
          >
            {template.name}
          </Button>
        );
      })}
    </div>
  );
}
