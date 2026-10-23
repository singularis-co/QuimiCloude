'use client';

import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { WhatsappTemplateView } from '@/lib/modules/integraciones';

import { isMappable, notCompatibleReasonOf, usageBadgeOf } from './whatsapp-template-rules';

export const WHATSAPP_TEMPLATE_SWITCH_TESTID = 'whatsapp-template-switch';
export const WHATSAPP_TEMPLATE_USAGE_BADGE_TESTID = 'whatsapp-template-usage-badge';
export const WHATSAPP_TEMPLATE_RELATE_LINK_TESTID = 'whatsapp-template-relate-link';
export const WHATSAPP_TEMPLATE_RELATE_BUTTON_TESTID = 'whatsapp-template-relate-button';
export const WHATSAPP_TEMPLATE_NOT_COMPATIBLE_REASON_TESTID = 'whatsapp-template-not-compatible-reason';

export const WHATSAPP_TEMPLATE_USAGE_TEXTS = {
  enabled: 'Habilitada',
  disabled: 'Deshabilitada',
  switchLabel: (name: string, enabled: boolean) =>
    `${enabled ? 'Deshabilitar' : 'Habilitar'} ${name} para usarla en el sistema`,
  relate: 'Relacionar',
  relateVariables: 'Relacionar variables',
} as const;

export type WhatsappTemplateUsageProps = {
  readonly template: WhatsappTemplateView;
  /** El valor que se ve: puede ir por delante del guardado mientras responde el servidor. */
  readonly enabled: boolean;
  readonly pending: boolean;
  readonly onToggle: (template: WhatsappTemplateView, enabled: boolean) => void;
  readonly onRelate: (template: WhatsappTemplateView) => void;
};

/** La misma celda va en la tabla y en la tarjeta; cada una pinta su forma de «Relacionar». */
export function WhatsappTemplateUsage({ template, enabled, pending, onToggle, onRelate }: WhatsappTemplateUsageProps) {
  const badge = usageBadgeOf(template);

  if (badge === null) {
    return (
      <Switch
        checked={enabled}
        disabled={pending}
        className="md:min-h-11"
        aria-label={WHATSAPP_TEMPLATE_USAGE_TEXTS.switchLabel(template.name, enabled)}
        data-testid={WHATSAPP_TEMPLATE_SWITCH_TESTID}
        onCheckedChange={(next) => onToggle(template, next)}
      >
        {enabled ? WHATSAPP_TEMPLATE_USAGE_TEXTS.enabled : WHATSAPP_TEMPLATE_USAGE_TEXTS.disabled}
      </Switch>
    );
  }

  if (!isMappable(template)) {
    return (
      <span className="flex max-w-60 flex-col items-start gap-1 @max-[760px]:max-w-none">
        <StatusBadge tone={badge.tone} label={badge.label} data-testid={WHATSAPP_TEMPLATE_USAGE_BADGE_TESTID} />
        <span
          className="text-xs whitespace-normal text-muted-foreground"
          data-testid={WHATSAPP_TEMPLATE_NOT_COMPATIBLE_REASON_TESTID}
        >
          {notCompatibleReasonOf(template)}
        </span>
      </span>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1 @max-[760px]:hidden">
        <StatusBadge tone={badge.tone} label={badge.label} data-testid={WHATSAPP_TEMPLATE_USAGE_BADGE_TESTID} />
        <Button
          type="button"
          variant="link"
          size="sm"
          touch
          data-testid={WHATSAPP_TEMPLATE_RELATE_LINK_TESTID}
          onClick={() => onRelate(template)}
        >
          {WHATSAPP_TEMPLATE_USAGE_TEXTS.relate}
        </Button>
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        touch
        className="hidden @max-[760px]:inline-flex"
        data-testid={WHATSAPP_TEMPLATE_RELATE_BUTTON_TESTID}
        onClick={() => onRelate(template)}
      >
        {WHATSAPP_TEMPLATE_USAGE_TEXTS.relateVariables}
      </Button>
    </>
  );
}
