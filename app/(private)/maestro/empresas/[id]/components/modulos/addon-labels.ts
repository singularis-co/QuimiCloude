import type { LucideIcon } from 'lucide-react';

import type { Addon, CompanyAddonsView } from '@/lib/modules/identity';
import { ADDON_DETAILS } from '@/lib/shared/ui/addon-details';
import { ADDON_NAMES, type AddonNameKey } from '@/lib/shared/ui/addon-names';

export type AddonLabel = {
  readonly name: string;
  readonly description: string;
  readonly icon: LucideIcon;
};

// Se arma iterando ADDON_NAMES: `AddonNameKey` es igual a `Addon` (test de tipos de addon-names).
export const ADDON_LABELS: Readonly<Record<Addon, AddonLabel>> = Object.fromEntries(
  (Object.keys(ADDON_NAMES) as AddonNameKey[]).map((addon) => [
    addon,
    { name: ADDON_NAMES[addon], ...ADDON_DETAILS[addon] },
  ]),
) as Record<AddonNameKey, AddonLabel>;

export type AddonWriteVia = 'one' | 'all';

export function changedAddons(prev: CompanyAddonsView, next: CompanyAddonsView): readonly Addon[] {
  return next.addons
    .filter((state) => prev.addons.find((before) => before.addon === state.addon)?.enabled !== state.enabled)
    .map((state) => state.addon);
}

export function successMessage(changed: readonly Addon[], enabled: boolean, via: AddonWriteVia): string {
  const [only] = changed;
  if (via === 'one' && changed.length === 1 && only !== undefined) {
    return `${ADDON_LABELS[only].name} ${enabled ? 'prendido' : 'apagado'}.`;
  }
  if (changed.length === 1) {
    return enabled ? 'Se prendió 1 módulo.' : 'Se apagó 1 módulo.';
  }
  return enabled ? `Se prendieron ${changed.length} módulos.` : `Se apagaron ${changed.length} módulos.`;
}
