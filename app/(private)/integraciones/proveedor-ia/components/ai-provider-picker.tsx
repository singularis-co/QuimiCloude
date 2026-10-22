'use client';

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Check } from 'lucide-react';
import { useId } from 'react';

import type { AiProviderCode, AiProviderEntry } from '@/lib/modules/integraciones';

import { AI_PROVIDER_BRANDS } from './ai-provider-brand';
import { AiProviderLogo } from './ai-provider-logo';

export const AI_PROVIDER_PICKER_TESTID = 'ai-provider-picker';
export const AI_PROVIDER_OPTION_TESTID_PREFIX = 'ai-provider-option-';

export const AI_PROVIDER_PICKER_LABEL = 'Proveedor';

export type AiProviderPickerProps = {
  readonly providers: readonly AiProviderEntry[];
  readonly value: AiProviderCode;
  readonly onValueChange: (code: AiProviderCode) => void;
};

/**
 * Sin `name`: las radios ocultas de Base UI no viajan en el `FormData`. El proveedor lo lleva un
 * campo oculto del formulario, que el reinicio del `<form>` tras cada acción no toca.
 */
export function AiProviderPicker({ providers, value, onValueChange }: AiProviderPickerProps) {
  const baseId = useId();
  const legendId = `${baseId}-legend`;

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend id={legendId} className="mb-2 text-sm font-medium">
        {AI_PROVIDER_PICKER_LABEL}
      </legend>
      <RadioGroup<AiProviderCode>
        value={value}
        onValueChange={(next) => onValueChange(next)}
        aria-labelledby={legendId}
        data-testid={AI_PROVIDER_PICKER_TESTID}
        className="grid grid-cols-2 gap-2.5 @max-[760px]:grid-cols-1"
      >
        {providers.map((provider) => {
          const brand = AI_PROVIDER_BRANDS[provider.code];
          const nameId = `${baseId}-${provider.code}-name`;
          const subtitleId = `${baseId}-${provider.code}-subtitle`;
          return (
            <Radio.Root
              key={provider.code}
              value={provider.code}
              nativeButton
              render={<button type="button" />}
              aria-labelledby={nameId}
              aria-describedby={subtitleId}
              data-testid={`${AI_PROVIDER_OPTION_TESTID_PREFIX}${provider.code}`}
              className="group/option flex min-h-16 cursor-pointer items-center gap-3 rounded-[10px] border border-border bg-card p-3 text-left transition-[border-color,box-shadow] duration-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[checked]:border-primary data-[checked]:bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] data-[checked]:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_35%,transparent)]"
            >
              <AiProviderLogo code={provider.code} name={provider.name} size="form" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span id={nameId} className="font-semibold">
                  {provider.name}
                </span>
                <span id={subtitleId} className="text-xs text-muted-foreground">
                  {brand.subtitle}
                </span>
              </span>
              <Check
                aria-hidden="true"
                className="size-4 shrink-0 text-primary opacity-0 transition-opacity duration-100 group-data-[checked]/option:opacity-100"
              />
            </Radio.Root>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
