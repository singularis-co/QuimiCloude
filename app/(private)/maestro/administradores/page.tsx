import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import {
  ADMINISTRATORS_LABEL,
  BRAND_LABEL,
  NAV_SECTION_PLATFORM,
} from '@/lib/shared/navigation/private-nav';

export const metadata: Metadata = {
  title: `${ADMINISTRATORS_LABEL} · ${BRAND_LABEL}`,
};

export default async function MaestroAdministradoresPage() {
  await requirePagePermission('empresas.consultar');

  return (
    <PageShell>
      <PageHeader
        title={ADMINISTRATORS_LABEL}
        titleTestId="maestro-administradores-title"
        breadcrumb={{
          label: NAV_SECTION_PLATFORM,
          items: [{ label: NAV_SECTION_PLATFORM }, { label: ADMINISTRATORS_LABEL }],
        }}
      />
    </PageShell>
  );
}
