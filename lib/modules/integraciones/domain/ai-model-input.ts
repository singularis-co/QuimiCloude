import { z } from 'zod';

export const AI_MODEL_ID_MAX_LENGTH = 200;

export const aiModelInputSchema = z.object({
  modelId: z.string().trim().min(1).max(AI_MODEL_ID_MAX_LENGTH),
});

export type AiModelInput = z.infer<typeof aiModelInputSchema>;
