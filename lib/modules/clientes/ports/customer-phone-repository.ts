import type { CustomerScope } from '../domain/customer-scope';
import type { CustomerPhoneColumns } from '../domain/customer-view';

export type CustomerPhoneLink = { readonly linkId: string; readonly e164: string; readonly main: boolean };

/**
 * Los telefonos de un cliente. «Vivo» es del puerto: un vinculo quitado o un cliente dado de baja
 * no salen de ninguna lectura. Ningun metodo borra filas: quitar un telefono marca el vinculo.
 */
export interface CustomerPhoneRepository {
  isAlive(customerId: string, scope: CustomerScope): Promise<boolean>;

  listAliveLinks(customerId: string, scope: CustomerScope): Promise<readonly CustomerPhoneLink[]>;

  /** Crea el numero si la empresa aun no lo tiene, y el vinculo. */
  addLink(customerId: string, e164: string, main: boolean, now: Date, scope: CustomerScope): Promise<void>;

  removeLinks(linkIds: readonly string[], now: Date, scope: CustomerScope): Promise<void>;

  setMain(linkId: string, main: boolean, now: Date, scope: CustomerScope): Promise<void>;

  /** Las columnas `phone*` del cliente vivo; `null` las deja a nulo. */
  writeMainMirror(
    customerId: string,
    mirror: CustomerPhoneColumns | null,
    actorId: string,
    now: Date,
    scope: CustomerScope,
  ): Promise<void>;

  /** Clientes vivos con un vinculo vivo a un numero que coincide con `waId`. */
  findAliveOwners(waId: string, scope: CustomerScope): Promise<readonly string[]>;
}
