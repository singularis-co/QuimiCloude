import { z } from 'zod';

import { AI_MODEL_ID_MAX_LENGTH } from './ai-model-input';
import { AI_MODEL_ROLES } from './ai-model-pair';
import { AI_PROVIDER_CODES } from './ai-provider';

const modelIdSchema = z.string().trim().min(1).max(AI_MODEL_ID_MAX_LENGTH);

export const aiModelPairInputSchema = z.object({
  provider: z.enum(AI_PROVIDER_CODES),
  role: z.enum(AI_MODEL_ROLES),
  primaryModelId: modelIdSchema,
  fallbackModelId: modelIdSchema,
});

export type AiModelPairInput = z.infer<typeof aiModelPairInputSchema>;
