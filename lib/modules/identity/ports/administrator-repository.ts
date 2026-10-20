import type { AdministratorDetail, AdministratorRow } from '../domain/administrator-view';
import type { ListQuery } from '../domain/list-query';
import type { Page } from '../domain/page';

import type { DuplicateKey, NewUser } from './user-admin-repository';

// Ningun metodo recibe un rol: el adaptador resuelve el de Administrador por nombre, y asi no hay
// forma de crear ni de editar a otro rol por aqui.
export type AdministratorWrite = Omit<NewUser, 'roleId'>;

export interface AdministratorRepository {
  list(query: ListQuery): Promise<Page<AdministratorRow>>;

  /** Administrador vivo de empresa viva; cualquier otro caso es `null`. */
  findManageable(id: string): Promise<AdministratorDetail | null>;

  create(input: {
    readonly companyId: string;
    readonly administrator: AdministratorWrite;
    readonly now: Date;
  }): Promise<
    { readonly administratorId: string } | 'company_not_found' | DuplicateKey | 'invalid_document_type'
  >;

  update(input: {
    readonly id: string;
    readonly data: AdministratorWrite;
    readonly now: Date;
  }): Promise<'ok' | 'not_found' | DuplicateKey | 'invalid_document_type'>;

  softDelete(input: {
    readonly id: string;
    readonly now: Date;
  }): Promise<'ok' | 'not_found' | 'last_administrator'>;
}
