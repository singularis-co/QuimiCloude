import type { UserAccountStatus } from './account-status';

export type AdministratorCompany = { readonly id: string; readonly name: string };

// Ni credencial, ni contadores de acceso, ni marca de baja: no hay hueco para ellos.
export type AdministratorRow = {
  readonly id: string;
  readonly firstNames: string;
  readonly lastNames: string;
  readonly username: string;
  readonly email: string;
  readonly company: AdministratorCompany;
  readonly accountStatus: UserAccountStatus;
  readonly createdAt: Date;
  readonly isLastAdministrator: boolean;
};

export type AdministratorDetail = {
  readonly id: string;
  readonly firstNames: string;
  readonly lastNames: string;
  readonly birthDate: Date;
  readonly email: string;
  readonly phone: string;
  readonly documentTypeCode: string;
  readonly documentNumber: string;
  readonly username: string;
  readonly company: AdministratorCompany;
  readonly accountStatus: UserAccountStatus;
  readonly accountStatusChangedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isLastAdministrator: boolean;
};
