import { ADDONS, ADDON_REQUIRES, effectiveAddons, type Addon } from './company-addons';

export type CompanyAddonState = {
  readonly addon: Addon;
  /** El interruptor guardado. */
  readonly enabled: boolean;
  /** Prendido y con sus dependencias prendidas: lo que de verdad cuenta. */
  readonly active: boolean;
  readonly requires: readonly Addon[];
};

export type CompanyAddonsView = {
  readonly companyId: string;
  readonly addons: readonly CompanyAddonState[];
};

export function toCompanyAddonsView(companyId: string, stored: readonly string[]): CompanyAddonsView {
  const active = effectiveAddons(stored);
  return {
    companyId,
    addons: ADDONS.map((addon) => ({
      addon,
      enabled: stored.includes(addon),
      active: active.includes(addon),
      requires: ADDON_REQUIRES[addon],
    })),
  };
}
