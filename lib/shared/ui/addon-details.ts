import {
  FileTextIcon,
  LayoutDashboardIcon,
  PuzzleIcon,
  SheetIcon,
  TruckIcon,
  type LucideIcon,
} from 'lucide-react';

import type { AddonNameKey } from './addon-names';

export type AddonDetail = {
  readonly description: string;
  readonly icon: LucideIcon;
};

// Hermano de addon-names.ts: un añadido nuevo en AddonNameKey rompe el typecheck hasta tener su entrada.
export const ADDON_DETAILS: Readonly<Record<AddonNameKey, AddonDetail>> = {
  dashboard: {
    description: 'Indicadores del día y recorrido de cada pedido.',
    icon: LayoutDashboardIcon,
  },
  proveedores: {
    description: 'Directorio de proveedores y su catálogo.',
    icon: TruckIcon,
  },
  lectura_pdf: {
    description: 'Lee fórmulas y catálogos desde un PDF.',
    icon: FileTextIcon,
  },
  importacion_excel: {
    description: 'Carga inventario y catálogos desde una hoja de cálculo.',
    icon: SheetIcon,
  },
  integraciones: {
    description: 'Proveedor IA, Inventarios y WhatsApp.',
    icon: PuzzleIcon,
  },
};
