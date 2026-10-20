import type { CustomerScope } from '../domain/customer-scope';
import type { ListQuery } from '../domain/list-query';
import type { CustomerPhoneColumns, NewCustomer, CustomerView } from '../domain/customer-view';
import type { Page } from '../domain/page';

/**
 * Puerto de acceso a datos del cliente. El sufijo `Alive` no es adorno: el filtro
 * `deleted_at IS NULL` es de este puerto y de su adaptador, no del dominio, y asi ningun caso
 * de uso puede olvidarlo. Sin ninguna operacion de restaurar ni de listar dados de baja.
 *
 * `'duplicate_phone'` sale de la violacion del indice unico del telefono, no de una consulta
 * previa: dos guardados simultaneos no pueden pasar los dos. Ningun otro dato es unico.
 *
 * Los cinco metodos exigen `scope: CustomerScope` al final de la firma: una llamada que lo
 * omita no compila.
 */
export interface CustomerRepository {
  /** El alta siempre escribe las columnas del telefono: no hay fila previa que conservar. */
  create(
    data: NewCustomer & { readonly phone: CustomerPhoneColumns },
    actorId: string,
    now: Date,
    scope: CustomerScope,
  ): Promise<{ id: string } | 'duplicate_phone'>;

  /** `null` = no existe, esta dado de baja, o es de otra empresa: para el dominio son el
   *  mismo caso. */
  findAliveById(id: string, scope: CustomerScope): Promise<CustomerView | null>;

  updateAlive(
    id: string,
    data: NewCustomer,
    actorId: string,
    now: Date,
    scope: CustomerScope,
  ): Promise<'ok' | 'not_found' | 'duplicate_phone'>;

  softDeleteAlive(id: string, actorId: string, now: Date, scope: CustomerScope): Promise<boolean>;

  listAlive(query: ListQuery, scope: CustomerScope): Promise<Page<CustomerView>>;
}
