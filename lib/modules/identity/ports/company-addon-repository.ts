import type { Addon } from '../domain/company-addons';

export type AddonChange = { readonly addon: Addon; readonly enabled: boolean };

export interface CompanyAddonRepository {
  /** Los interruptores guardados tal cual, también de una empresa de baja. `null` si no existe. */
  findByCompany(companyId: string): Promise<{ stored: readonly string[]; alive: boolean } | null>;
  /** Solo escribe en una empresa viva; sin cambios no escribe nada. */
  apply(input: {
    companyId: string;
    enable?: readonly Addon[];
    disable?: readonly Addon[];
    actorId: string;
    now: Date;
  }): Promise<{ stored: readonly string[]; changed: readonly AddonChange[] } | 'not_found'>;
}
