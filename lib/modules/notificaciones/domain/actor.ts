import type { InboxScope } from '../ports/notification-inbox';

import { retentionCutoff } from './retention';

/**
 * Quien lee su bandeja. Leer y marcar los avisos propios no pide permiso: `companyId`, `id` y
 * `roleName` solo acotan qué avisos son suyos, y salen de la sesión del servidor.
 */
export type Actor = {
  readonly id: string;
  readonly companyId: string;
  readonly roleName: string | null;
};

export function inboxScopeOf(actor: Actor, now: Date): InboxScope {
  return {
    companyId: actor.companyId,
    userId: actor.id,
    roleName: actor.roleName,
    cutoff: retentionCutoff(now),
  };
}
