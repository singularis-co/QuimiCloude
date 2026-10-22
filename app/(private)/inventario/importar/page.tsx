import type { Metadata } from 'next';

import { ArrowLink } from '@/components/shared/arrow-link';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { requirePageAddon } from '@/lib/modules/identity/adapters/driving/require-page-addon';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { getInventoryImportValuesAction } from '@/lib/modules/inventario/adapters/driving/inventory-import-actions';
import { listUnitsAction } from '@/lib/modules/unidades/adapters/driving/unit-actions';
import { BRAND_LABEL } from '@/lib/shared/navigation/private-nav';
import { INVENTORY_ROUTE } from '@/lib/shared/routes';

import {
  IMPORT_BACK_LABEL,
  IMPORT_BACK_LINK_TESTID,
  IMPORT_PAGE_DESCRIPTION,
  IMPORT_PAGE_TITLE,
  IMPORT_TITLE_TESTID,
  ImportGuide,
  ImportTemplateButton,
  InventoryImportScreen,
} from './components';

export const metadata: Metadata = {
  title: `${IMPORT_PAGE_TITLE} · ${BRAND_LABEL}`,
};

// La confirmación escribe hasta 2.000 filas en la misma petición.
export const maxDuration = 300;

export default async function InventoryImportPage() {
  await requirePagePermission('inventario.modificar');
  await requirePageAddon('importacion_excel');

  // Si el catálogo de unidades no se puede leer, la importación sigue disponible; solo los
  // diálogos de alta de faltantes se quedan sin unidades que ofrecer.
  // Igual con la guía: sin los valores de la empresa sigue mostrando reglas, tipos y ejemplos.
  const [unitsResult, valuesResult] = await Promise.all([listUnitsAction(), getInventoryImportValuesAction()]);
  const units = unitsResult.status === 'success' ? unitsResult.data : [];
  const values = valuesResult.status === 'success' ? valuesResult.data : null;

  return (
    <PageShell>
      <div className="flex flex-col gap-2.5">
        <ArrowLink
          direction="back"
          href={INVENTORY_ROUTE}
          touch
          testId={IMPORT_BACK_LINK_TESTID}
          className="self-start"
        >
          {IMPORT_BACK_LABEL}
        </ArrowLink>
        <PageHeader title={IMPORT_PAGE_TITLE} titleTestId={IMPORT_TITLE_TESTID} actions={<ImportTemplateButton />} />
        <p className="max-w-[720px] text-sm text-muted-foreground">{IMPORT_PAGE_DESCRIPTION}</p>
      </div>
      <InventoryImportScreen units={units} />
      <ImportGuide values={values} />
    </PageShell>
  );
}
