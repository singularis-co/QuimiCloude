import type { AiProviderCode } from '@/lib/modules/integraciones';

export type AiProviderBrand = {
  /** Letra del recuadro mientras no estén los logos oficiales del kit de marca de cada proveedor. */
  readonly monogram: string;
  readonly subtitle: string;
  readonly consoleUrl: string;
};

export const AI_PROVIDER_BRANDS: Readonly<Record<AiProviderCode, AiProviderBrand>> = {
  ANTHROPIC: {
    monogram: 'C',
    subtitle: 'Anthropic',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
  },
  GOOGLE: {
    monogram: 'G',
    subtitle: 'Google',
    consoleUrl: 'https://aistudio.google.com/apikey',
  },
  OPENAI: {
    monogram: 'O',
    subtitle: 'GPT',
    consoleUrl: 'https://platform.openai.com/api-keys',
  },
  OPENROUTER: {
    monogram: 'R',
    subtitle: 'Muchos modelos con una key',
    consoleUrl: 'https://openrouter.ai/settings/keys',
  },
};
