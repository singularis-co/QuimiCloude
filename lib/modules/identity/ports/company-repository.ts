import type { CompanyDetail, CompanyEventView, CompanyRow } from '../domain/company-view';
import type { ListQuery } from '../domain/list-query';
import type { Page } from '../domain/page';

import type { DuplicateKey, NewUser } from './user-admin-repository';

export type CompanyWrite = {
  readonly name: string;
  readonly nameNormalized: string;
  readonly taxId: string | null;
  readonly taxIdNormalized: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
};

// El rol no lo elige quien llama: el Administrador inicial siempre nace con el rol Administrador.
export type NewAdministrator = Omit<NewUser, 'roleId'>;

export type CompanyDuplicate = 'duplicate_name' | 'duplicate_tax_id';

// Cada escritura deja su evento de historial en la misma transaccion. No hay ningun metodo que
// modifique ni borre un evento.
export interface CompanyRepository {
  createWithAdministrator(input: {
    readonly company: CompanyWrite;
    readonly administrator: NewAdministrator;
    readonly actorId: string;
    readonly now: Date;
  }): Promise<
    | { readonly companyId: string; readonly administratorId: string }
    | CompanyDuplicate
    | DuplicateKey
    | 'invalid_document_type'
  >;

  /** Tambien sobre una empresa de baja, sin chocar: el choque se comprueba al reactivar. */
  update(input: {
    readonly companyId: string;
    readonly data: CompanyWrite;
    readonly actorId: string;
    readonly now: Date;
  }): Promise<'ok' | 'unchanged' | 'not_found' | CompanyDuplicate>;

  /** Solo empresas vivas; una de baja responde `not_found`. */
  softDelete(input: {
    readonly companyId: string;
    readonly confirmationNormalized: string;
    readonly actorId: string;
    readonly now: Date;
  }): Promise<'ok' | 'not_found' | 'name_mismatch'>;

  reactivate(input: {
    readonly companyId: string;
    readonly actorId: string;
    readonly now: Date;
  }): Promise<'ok' | 'not_found' | 'not_deleted' | CompanyDuplicate>;

  list(query: ListQuery): Promise<Page<CompanyRow>>;

  findById(companyId: string): Promise<CompanyDetail | null>;

  /** Solo empresas vivas; una de baja responde `not_found`. */
  countLiveUsersOfAlive(companyId: string): Promise<number | 'not_found'>;

  listEvents(
    companyId: string,
    page: { readonly page?: number; readonly pageSize?: number },
  ): Promise<Page<CompanyEventView> | 'not_found'>;
}
