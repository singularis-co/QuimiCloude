import Link from 'next/link';

import { Notice } from '@/components/shared/notice';
import { buttonVariants } from '@/components/ui/button';
import { AI_PROVIDER_INTEGRATION_ROUTE } from '@/lib/shared/routes';
import { cn } from '@/lib/utils';

export const AI_PROVIDER_REQUIRED_NOTICE_TESTID = 'ai-provider-required-notice';
export const AI_PROVIDER_REQUIRED_NOTICE_LINK_TESTID = 'ai-provider-required-notice-link';
export const AI_PROVIDER_REQUIRED_NOTICE_ASK_TESTID = 'ai-provider-required-notice-ask';

export type AiProviderRequiredNoticeLabels = {
  readonly lead: string;
  readonly detail: string;
  readonly link: string;
  readonly ask: string;
};

export const AI_PROVIDER_REQUIRED_NOTICE_LABELS: AiProviderRequiredNoticeLabels = {
  lead: 'Para leer PDF, conecta el proveedor IA de tu empresa.',
  detail: 'La lectura usa tu propia API key.',
  link: 'Ir a Proveedor IA',
  ask: 'Pídele a un administrador que lo configure',
};

export type AiProviderRequiredNoticeProps = {
  /** Con él, enlace a la pantalla de configuración; sin él, solo el texto de pedírselo a alguien. */
  readonly canConfigure: boolean;
  readonly labels?: AiProviderRequiredNoticeLabels;
  readonly className?: string;
};

export function AiProviderRequiredNotice({
  canConfigure,
  labels = AI_PROVIDER_REQUIRED_NOTICE_LABELS,
  className,
}: AiProviderRequiredNoticeProps) {
  return (
    <Notice tone="info" testId={AI_PROVIDER_REQUIRED_NOTICE_TESTID} className={className}>
      <span className="flex flex-col items-start gap-2">
        <span>
          <strong className="font-semibold">{labels.lead}</strong> {labels.detail}
        </span>
        {canConfigure ? (
          // Un enlace y no `Button` con `render`: Base UI le pondría `role="button"` al `<a>`.
          <Link
            href={AI_PROVIDER_INTEGRATION_ROUTE}
            data-slot="button"
            data-testid={AI_PROVIDER_REQUIRED_NOTICE_LINK_TESTID}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm', touch: true }), 'no-underline')}
          >
            {labels.link}
          </Link>
        ) : (
          <span data-testid={AI_PROVIDER_REQUIRED_NOTICE_ASK_TESTID}>{labels.ask}</span>
        )}
      </span>
    </Notice>
  );
}
