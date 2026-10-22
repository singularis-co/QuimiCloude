import { effectiveAddons, type Addon } from './company-addons';

import type { CompanyField } from './company-event';

export type CompanyStatus = 'active' | 'deleted';

export type CompanyRow = {
  readonly id: string;
  readonly name: string;
  readonly taxId: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly country: string | null;
  readonly liveUserCount: number;
  readonly createdAt: Date;
  readonly status: CompanyStatus;
  /** En el orden de `ADDONS`. Una empresa de baja conserva los suyos, como en su ficha. */
  readonly activeAddons: readonly Addon[];
};

/** La fila tal como sale del puerto: los interruptores guardados, sin resolver dependencias. */
export type CompanyListRecord = Omit<CompanyRow, 'activeAddons'> & {
  readonly storedAddons: readonly string[];
};

export function toCompanyRow({ storedAddons, ...rest }: CompanyListRecord): CompanyRow {
  return { ...rest, activeAddons: effectiveAddons(storedAddons) };
}

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
  /** La clave del añadido en los eventos de añadido; `null` en el resto. */
  readonly addon: string | null;
};
