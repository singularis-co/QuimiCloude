import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import {
  BRAND_LABEL,
  COMPANIES_LABEL,
  NAV_SECTION_PLATFORM,
} from '@/lib/shared/navigation/private-nav';

export const metadata: Metadata = {
  title: `${COMPANIES_LABEL} · ${BRAND_LABEL}`,
};

export default async function MaestroEmpresasPage() {
  await requirePagePermission('empresas.consultar');

  return (
    <PageShell>
      <PageHeader
        title={COMPANIES_LABEL}
        titleTestId="maestro-empresas-title"
        breadcrumb={{
          label: NAV_SECTION_PLATFORM,
          items: [{ label: NAV_SECTION_PLATFORM }, { label: COMPANIES_LABEL }],
        }}
      />
    </PageShell>
  );
}
