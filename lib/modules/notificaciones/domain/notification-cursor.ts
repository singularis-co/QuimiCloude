import { z } from 'zod';

import type { InboxCursor } from '../ports/notification-inbox';

import { ValidationError } from './errors';

const cursorSchema = z.strictObject({
  t: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
  i: z.uuid(),
});

/** Lo que el navegador manda para pedir un lote: `null` es el primero. */
export const listNotificationsInputSchema = z.strictObject({
  cursor: z.string().min(1).nullable(),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsInputSchema>;

/** Opaco para el navegador: base64url del JSON `{ t, i }`. */
export function encodeNotificationCursor(cursor: InboxCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.t, i: cursor.i }), 'utf8').toString('base64url');
}

/** Lanza `ValidationError` con cualquier cosa que no sea un cursor emitido por `encode`. */
export function decodeNotificationCursor(encoded: string): InboxCursor {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError('cursor: no es JSON en base64url');
  }
  const parsed = cursorSchema.safeParse(decoded);
  if (!parsed.success) throw new ValidationError('cursor: forma no valida');
  return parsed.data;
}
