import type { AiProviderCode } from '@/lib/modules/integraciones';
import { cn } from '@/lib/utils';

import { AI_PROVIDER_BRANDS } from './ai-provider-brand';

export const AI_PROVIDER_LOGO_TESTID = 'ai-provider-logo';

const SIZE_CLASS = {
  form: 'size-10 text-[15px]',
  card: 'size-11 text-base',
} as const;

export type AiProviderLogoProps = {
  readonly code: AiProviderCode;
  readonly name: string;
  readonly size: keyof typeof SIZE_CLASS;
};

export function AiProviderLogo({ code, name, size }: AiProviderLogoProps) {
  return (
    <span
      role="img"
      aria-label={name}
      data-testid={AI_PROVIDER_LOGO_TESTID}
      data-provider={code}
      className={cn(
        'grid shrink-0 place-items-center rounded-lg border border-dashed border-input font-semibold text-muted-foreground',
        SIZE_CLASS[size],
      )}
    >
      <span aria-hidden="true">{AI_PROVIDER_BRANDS[code].monogram}</span>
    </span>
  );
}
