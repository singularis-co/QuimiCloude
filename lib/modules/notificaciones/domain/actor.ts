import { assertPermission, type PermissionCode } from '@/lib/modules/identity';

import type { InboxScope } from '../ports/notification-inbox';

import { UnauthorizedError } from './errors';
import { retentionCutoff } from './retention';

/**
 * Quien lee su bandeja. `roleName` sale de la misma lectura de sesión que los permisos y solo acota
 * qué avisos son suyos; lo que autoriza es el permiso.
 */
export type Actor = {
  readonly id: string;
  readonly companyId: string;
  readonly roleName: string | null;
  readonly permissions: readonly string[];
};

export const NOTIFICATIONS_READ_PERMISSION: PermissionCode = 'notificaciones.consultar';

/** Con el añadido apagado el permiso no llega en `permissions`, así que también se corta aquí. */
export function requirePermission(
  actor: Actor | null | undefined,
  permission: PermissionCode,
): asserts actor is Actor {
  assertPermission(actor, permission, () => new UnauthorizedError());
}

export function inboxScopeOf(actor: Actor, now: Date): InboxScope {
  return {
    companyId: actor.companyId,
    userId: actor.id,
    roleName: actor.roleName,
    cutoff: retentionCutoff(now),
  };
}
