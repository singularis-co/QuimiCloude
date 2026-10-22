import type { CustomerScope } from '../domain/customer-scope';
import type { CustomerPhoneColumns, NewCustomer } from '../domain/customer-view';

export type CustomerUpdateResult =
  | { readonly kind: 'ok'; readonly before: string | null; readonly after: string | null }
  | 'not_found';

/** Las escrituras del cliente que van en la misma transaccion que sus telefonos. */
export interface CustomerWriteRepository {
  create(
    data: NewCustomer & { readonly phone: CustomerPhoneColumns },
    actorId: string,
    now: Date,
    scope: CustomerScope,
  ): Promise<{ id: string }>;

  /** `before`/`after`: el `phone_e164` de la fila antes y despues de escribir. Con el numero
   *  vacio, `after` lo decide la fila y no la entrada. */
  updateAlive(
    id: string,
    data: NewCustomer,
    actorId: string,
    now: Date,
    scope: CustomerScope,
  ): Promise<CustomerUpdateResult>;
}
