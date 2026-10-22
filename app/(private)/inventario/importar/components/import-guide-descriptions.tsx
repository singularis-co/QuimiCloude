import Link from 'next/link';
import type { ReactNode } from 'react';

import type { ImportColumnKey } from '@/lib/modules/inventario';
import { FORMULAS_ROUTE, PRESENTATIONS_ROUTE, UNITS_ROUTE } from '@/lib/shared/routes';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import {
  GUIDE_CATALOG_LINK_LABELS,
  GUIDE_CATALOG_LINK_TESTIDS,
  GUIDE_COLUMN_DESCRIPTION_TEXTS,
  type GuideCatalogColumn,
} from './import-texts';

/** Módulo donde se gestiona el catálogo de cada columna enlazada desde la guía. */
export const GUIDE_CATALOG_LINK_ROUTES: Readonly<Record<GuideCatalogColumn, string>> = {
  unit: UNITS_ROUTE,
  presentation: PRESENTATIONS_ROUTE,
  formula: FORMULAS_ROUTE,
};

/**
 * La guía se muestra solo a quien ya entró a la importación; el acceso a cada módulo lo
 * decide su propia página, así que el enlace se muestra siempre.
 */
function CatalogDescription({ column }: { column: GuideCatalogColumn }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <span>{GUIDE_COLUMN_DESCRIPTION_TEXTS[column]}</span>
      <Link
        href={GUIDE_CATALOG_LINK_ROUTES[column]}
        data-testid={GUIDE_CATALOG_LINK_TESTIDS[column]}
        className={cn('inline-flex items-center font-medium text-primary underline-offset-4 hover:underline', touchTarget)}
      >
        {GUIDE_CATALOG_LINK_LABELS[column]}
      </Link>
    </span>
  );
}

export const GUIDE_COLUMN_DESCRIPTIONS: Readonly<Record<ImportColumnKey, ReactNode>> = {
  ...GUIDE_COLUMN_DESCRIPTION_TEXTS,
  unit: <CatalogDescription column="unit" />,
  presentation: <CatalogDescription column="presentation" />,
  formula: <CatalogDescription column="formula" />,
};
