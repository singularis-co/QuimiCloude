import {
  FileTextIcon,
  LayoutDashboardIcon,
  PuzzleIcon,
  SheetIcon,
  TruckIcon,
  type LucideIcon,
} from 'lucide-react';

import type { Addon, CompanyAddonsView } from '@/lib/modules/identity';
import { ADDON_NAMES } from '@/lib/shared/ui/addon-names';

export type AddonLabel = {
  readonly name: string;
  readonly description: string;
  readonly icon: LucideIcon;
};

export const ADDON_LABELS: Readonly<Record<Addon, AddonLabel>> = {
  dashboard: {
    name: ADDON_NAMES.dashboard,
    description: 'Indicadores del día y recorrido de cada pedido.',
    icon: LayoutDashboardIcon,
  },
  proveedores: {
    name: ADDON_NAMES.proveedores,
    description: 'Directorio de proveedores y su catálogo.',
    icon: TruckIcon,
  },
  lectura_pdf: {
    name: ADDON_NAMES.lectura_pdf,
    description: 'Lee fórmulas y catálogos desde un PDF.',
    icon: FileTextIcon,
  },
  importacion_excel: {
    name: ADDON_NAMES.importacion_excel,
    description: 'Carga inventario y catálogos desde una hoja de cálculo.',
    icon: SheetIcon,
  },
  integraciones: {
    name: ADDON_NAMES.integraciones,
    description: 'Proveedor IA, Inventarios y WhatsApp.',
    icon: PuzzleIcon,
  },
};

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
