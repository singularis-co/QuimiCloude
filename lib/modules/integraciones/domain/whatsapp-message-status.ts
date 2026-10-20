import type { WhatsappMessageStatus } from './whatsapp-message';

/**
 * Desde qué estados puede llegar cada status de Meta. Meta no garantiza el orden ni que lleguen
 * todos, así que saltar pasos vale; retroceder no. La condición la aplica el `where` del `UPDATE`,
 * no una lectura previa, para que dos webhooks concurrentes no puedan hacer retroceder el estado.
 */
export const STATUS_PREDECESSORS = {
  SENT: ['QUEUED', 'SENDING'],
  DELIVERED: ['QUEUED', 'SENDING', 'SENT'],
  READ: ['QUEUED', 'SENDING', 'SENT', 'DELIVERED'],
  FAILED: ['QUEUED', 'SENDING', 'SENT'],
} as const satisfies Record<string, readonly WhatsappMessageStatus[]>;

export type WhatsappStatusUpdate = keyof typeof STATUS_PREDECESSORS;

export const WHATSAPP_STATUS_UPDATES = Object.keys(STATUS_PREDECESSORS) as readonly WhatsappStatusUpdate[];

export function isWhatsappStatusUpdate(value: string): value is WhatsappStatusUpdate {
  return Object.hasOwn(STATUS_PREDECESSORS, value);
}

export function canApplyStatus(current: WhatsappMessageStatus, incoming: WhatsappStatusUpdate): boolean {
  return (STATUS_PREDECESSORS[incoming] as readonly WhatsappMessageStatus[]).includes(current);
}
