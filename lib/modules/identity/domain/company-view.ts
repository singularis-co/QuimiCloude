import type { CompanyField } from './company-event';

export type CompanyStatus = 'active' | 'deleted';

export type CompanyRow = {
  readonly id: string;
  readonly name: string;
  readonly taxId: string | null;
  readonly country: string | null;
  readonly liveUserCount: number;
  readonly createdAt: Date;
  readonly status: CompanyStatus;
};

export type CompanyDetail = {
  readonly id: string;
  readonly name: string;
  readonly taxId: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly country: string | null;
  readonly createdAt: Date;
  readonly status: CompanyStatus;
  readonly deletedAt: Date | null;
};

export type CompanyDeletionImpact = {
  readonly liveUsers: number;
  readonly openOrders: number;
};

// `kind` es texto libre: el historial puede traer tipos de otros ambitos que esta lista no conoce,
// y leerlos no debe fallar.
export type CompanyEventView = {
  readonly id: string;
  readonly kind: string;
  readonly occurredAt: Date;
  readonly actor: { readonly id: string; readonly firstNames: string; readonly lastNames: string };
  readonly fields: readonly CompanyField[];
};
