import { z } from 'zod';

import { AI_PROVIDER_CODES } from './ai-provider';

export const AI_PROVIDER_API_KEY_MAX_LENGTH = 1024;

/** La misma entrada para probar una key escrita y para guardarla. */
export const aiProviderKeyInputSchema = z.object({
  provider: z.enum(AI_PROVIDER_CODES),
  apiKey: z.string().trim().min(1).max(AI_PROVIDER_API_KEY_MAX_LENGTH),
});

export type AiProviderKeyInput = z.infer<typeof aiProviderKeyInputSchema>;
