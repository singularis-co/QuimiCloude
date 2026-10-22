import type { CustomerScope } from '../domain/customer-scope';
import type { ListQuery } from '../domain/list-query';
import type { CustomerView } from '../domain/customer-view';
import type { Page } from '../domain/page';

/**
 * Puerto de acceso a datos del cliente. El sufijo `Alive` no es adorno: el filtro
 * `deleted_at IS NULL` es de este puerto y de su adaptador, no del dominio, y asi ningun caso
 * de uso puede olvidarlo. Sin ninguna operacion de restaurar ni de listar dados de baja.
 *
 * Los metodos exigen `scope: CustomerScope` al final de la firma: una llamada que lo omita no
 * compila. El alta y la edicion van por `CustomerWriteRepository`, dentro de la transaccion que
 * tambien escribe los telefonos.
 */
export interface CustomerRepository {
  /** `null` = no existe, esta dado de baja, o es de otra empresa: para el dominio son el
   *  mismo caso. */
  findAliveById(id: string, scope: CustomerScope): Promise<CustomerView | null>;

  softDeleteAlive(id: string, actorId: string, now: Date, scope: CustomerScope): Promise<boolean>;

  listAlive(query: ListQuery, scope: CustomerScope): Promise<Page<CustomerView>>;
}
