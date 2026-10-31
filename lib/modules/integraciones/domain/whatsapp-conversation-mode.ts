import { z } from 'zod';

import { ValidationError } from './errors';

export const CONVERSATION_MODES = ['AGENT', 'HUMAN'] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export const CONVERSATION_MODE_REASONS = [
  'MANUAL',
  'CUSTOMER_REQUEST',
  'MISSING_DATA',
  'LOW_CONFIDENCE',
  'AI_ERROR',
  'USAGE_LIMIT',
  'USER_REPLY',
  'COMPLAINT',
  'NEGATIVE_SENTIMENT',
  'UNSUPPORTED_MEDIA',
  'INACTIVITY',
] as const;

export type ConversationModeReason = (typeof CONVERSATION_MODE_REASONS)[number];

export const REASONS_BY_TARGET: Readonly<Record<ConversationMode, readonly ConversationModeReason[]>> = Object.freeze({
  HUMAN: Object.freeze([
    'MANUAL',
    'CUSTOMER_REQUEST',
    'MISSING_DATA',
    'LOW_CONFIDENCE',
    'AI_ERROR',
    'USAGE_LIMIT',
    'USER_REPLY',
    'COMPLAINT',
    'NEGATIVE_SENTIMENT',
    'UNSUPPORTED_MEDIA',
  ] as const),
  AGENT: Object.freeze(['MANUAL', 'INACTIVITY'] as const),
});

/** Lanza si el motivo no vale para el destino, también cuando la conversación ya está en él. */
export function planModeChange(
  current: ConversationMode,
  target: ConversationMode,
  reason: ConversationModeReason,
): 'unchanged' | 'change' {
  if (!REASONS_BY_TARGET[target].includes(reason)) throw new ValidationError();
  return current === target ? 'unchanged' : 'change';
}

export type AgentReturnCandidate = {
  readonly mode: ConversationMode;
  readonly modeChangedAt: Date | null;
  readonly lastMessageAt: Date | null;
};

const HOUR_MS = 3_600_000;

export function isDueForAgentReturn(conversation: AgentReturnCandidate, inactivityHours: number, now: Date): boolean {
  if (conversation.mode !== 'HUMAN') return false;
  const times = [conversation.modeChangedAt, conversation.lastMessageAt]
    .filter((date): date is Date => date !== null)
    .map((date) => date.getTime());
  if (times.length === 0) return false;
  return now.getTime() - Math.max(...times) >= inactivityHours * HOUR_MS;
}

export const conversationModeInputSchema = z.object({ contactId: z.string().uuid() });

export type ConversationModeInput = z.infer<typeof conversationModeInputSchema>;

/** Lo que ve quien consulta: motivo y fecha nulos si el modo nunca cambió. */
export type ConversationModeView = {
  readonly mode: ConversationMode;
  readonly reason: ConversationModeReason | null;
  readonly changedAt: Date | null;
};
