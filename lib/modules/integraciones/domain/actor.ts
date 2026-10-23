import { CUSTOMER_MODIFY_PERMISSION } from '@/lib/modules/clientes';
import { assertAddon, assertPermission } from '@/lib/modules/identity';

import { UnauthorizedError } from './errors';

export type Actor = {
  readonly id: string;
  readonly companyId: string;
  readonly permissions: readonly string[];
  readonly addons?: readonly string[];
};

const CONFIGURE_PERMISSION = 'integraciones.modificar';
export const WHATSAPP_SEND_PERMISSION = 'whatsapp.enviar';

/**
 * Primera línea de cada caso de uso, antes de validar la entrada y de tocar un puerto. Un actor
 * sin empresa se rechaza igual que uno sin permiso: el ámbito de toda lectura sale de ella.
 */
export function requirePermission(actor: Actor | null | undefined): asserts actor is Actor {
  assertPermission(actor, CONFIGURE_PERMISSION, () => new UnauthorizedError());
  if (typeof actor?.companyId !== 'string' || actor.companyId === '') {
    throw new UnauthorizedError();
  }
}

/**
 * Las acciones sobre el vínculo de un contacto escriben en los teléfonos del cliente, así que
 * exigen el permiso de `clientes`. El añadido apagado se rechaza igual que la falta de permiso.
 */
export function requireCustomerLinkPermission(actor: Actor | null | undefined): asserts actor is Actor {
  assertPermission(actor, CUSTOMER_MODIFY_PERMISSION, () => new UnauthorizedError());
  assertAddon(actor, 'integraciones', () => new UnauthorizedError());
  if (typeof actor?.companyId !== 'string' || actor.companyId === '') {
    throw new UnauthorizedError();
  }
}

/** El permiso ya llega quitado si el añadido está apagado: no hace falta comprobar el añadido. */
export function requireSendPermission(actor: Actor | null | undefined): asserts actor is Actor {
  assertPermission(actor, WHATSAPP_SEND_PERMISSION, () => new UnauthorizedError());
  if (typeof actor?.companyId !== 'string' || actor.companyId === '') {
    throw new UnauthorizedError();
  }
}

/** No lanza: decide qué se muestra, no autoriza. El corte real sigue en `requirePermission`. */
export function hasConfigurePermission(actor: Actor | null | undefined): boolean {
  try {
    assertPermission(actor, CONFIGURE_PERMISSION, () => new UnauthorizedError());
    return true;
  } catch {
    return false;
  }
}
