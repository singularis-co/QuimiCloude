import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { AiProviderCode } from '../../../domain/ai-provider';
import type { ModelTarget } from '../../../ports/conversational-model';

/** Mismo valor que en `documentos`: un adaptador de otro módulo no se importa. */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

type ModelFactory = (target: ModelTarget) => LanguageModel;

/** Un `Record` por código: un proveedor nuevo en el catálogo sin su constructor no compila. */
export const AI_SDK_MODELS: Record<AiProviderCode, ModelFactory> = {
  ANTHROPIC: ({ apiKey, model }) => createAnthropic({ apiKey })(model),
  GOOGLE: ({ apiKey, model }) => createGoogle({ apiKey })(model),
  OPENAI: ({ apiKey, model }) => createOpenAI({ apiKey })(model),
  // Llamar al proveedor directamente usa la API de respuestas; OpenRouter va por la de chat, como la lectura de PDF.
  OPENROUTER: ({ apiKey, model }) => createOpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL }).chat(model),
};

export function aiSdkModel(target: ModelTarget): LanguageModel {
  return AI_SDK_MODELS[target.provider](target);
}
