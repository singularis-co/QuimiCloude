'use client';

import Link from 'next/link';
import { useId, type ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AI_PROVIDER_INTEGRATION_ROUTE } from '@/lib/shared/routes';

export const AI_PROVIDER_REQUIRED_TOOLTIP_TESTID = 'ai-provider-required-tooltip';
export const AI_PROVIDER_REQUIRED_TOOLTIP_TRIGGER_TESTID = 'ai-provider-required-tooltip-trigger';
export const AI_PROVIDER_REQUIRED_TOOLTIP_LINK_TESTID = 'ai-provider-required-tooltip-link';

export type AiProviderRequiredTooltipLabels = {
  readonly message: string;
  readonly link: string;
};

export const AI_PROVIDER_REQUIRED_TOOLTIP_LABELS: AiProviderRequiredTooltipLabels = {
  message: 'Para leer PDF, conecta el proveedor IA de tu empresa',
  link: 'Inscribir proveedor',
};

export type AiProviderRequiredTooltipProps = {
  /** El control bloqueado, normalmente un botón con `disabled`. */
  readonly children: ReactNode;
  readonly labels?: AiProviderRequiredTooltipLabels;
};

export function AiProviderRequiredTooltip({
  children,
  labels = AI_PROVIDER_REQUIRED_TOOLTIP_LABELS,
}: AiProviderRequiredTooltipProps) {
  const descriptionId = useId();

  return (
    <Tooltip>
      {/* Un botón deshabilitado no recibe puntero ni foco: el envoltorio enfocable abre el globo. */}
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-describedby={descriptionId}
            data-testid={AI_PROVIDER_REQUIRED_TOOLTIP_TRIGGER_TESTID}
            className="inline-flex rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        data-testid={AI_PROVIDER_REQUIRED_TOOLTIP_TESTID}
        className="flex-col items-start gap-1"
      >
        <span id={descriptionId}>{labels.message}</span>
        <Link
          href={AI_PROVIDER_INTEGRATION_ROUTE}
          data-testid={AI_PROVIDER_REQUIRED_TOOLTIP_LINK_TESTID}
          className="font-medium text-background underline underline-offset-2"
        >
          {labels.link}
        </Link>
      </TooltipContent>
    </Tooltip>
  );
}
