import type { AiProviderFailure } from './ai-provider-failure';

import type { ModelTarget, ToolCallRecord } from '../ports/conversational-model';

/** Los códigos con los que un proveedor dice que está saturado; 500, 502 y 504 no cuentan. */
export const OVERLOAD_STATUSES: readonly number[] = [503, 529];

/**
 * Pura: si un fallo del principal justifica probar el respaldo. Key rechazada y cuota son de la
 * cuenta de la empresa: otro modelo con la misma key fallaría igual.
 */
export function shouldFallBack(failure: AiProviderFailure): boolean {
  switch (failure.kind) {
    case 'model_unavailable':
    case 'unreachable':
      return true;
    case 'unexpected':
      return failure.httpStatus !== null && OVERLOAD_STATUSES.includes(failure.httpStatus);
    case 'rejected_key':
    case 'quota':
      return false;
  }
}

export type CandidateModel = ModelTarget & { readonly supportsTools: boolean };

/** El modelo con el que salió el resultado y, si fue el respaldo, el fallo del principal. */
export type AttemptOrigin = {
  readonly model: string;
  readonly fallbackFrom: AiProviderFailure | null;
};

type Attempt = { readonly status: string };
type FailedAttempt = {
  readonly status: 'failed';
  readonly failure: AiProviderFailure;
  readonly toolCalls?: readonly ToolCallRecord[];
};

function isFailed(attempt: Attempt): attempt is FailedAttempt {
  return attempt.status === 'failed' && 'failure' in attempt;
}

function targetOf(candidate: CandidateModel): ModelTarget {
  return { provider: candidate.provider, model: candidate.model, apiKey: candidate.apiKey };
}

/**
 * Como mucho un intento con el respaldo, con la misma entrada. Con una herramienta ya ejecutada no
 * se cambia de modelo: repetirla podría duplicar su efecto.
 */
export async function withFallback<R extends Attempt>(
  models: { readonly primary: CandidateModel; readonly fallback: CandidateModel },
  needsTools: boolean,
  call: (target: ModelTarget) => Promise<R>,
): Promise<R & AttemptOrigin> {
  const first = await call(targetOf(models.primary));
  const fromPrimary = { ...first, model: models.primary.model, fallbackFrom: null };
  if (!isFailed(first) || !shouldFallBack(first.failure)) return fromPrimary;
  if ((first.toolCalls ?? []).some((record) => record.executed)) return fromPrimary;
  if (needsTools && !models.fallback.supportsTools) return fromPrimary;

  const second = await call(targetOf(models.fallback));
  return { ...second, model: models.fallback.model, fallbackFrom: first.failure };
}
