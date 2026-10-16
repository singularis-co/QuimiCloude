import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { identity } from '@/lib/composition';
import { assertPermission } from '@/lib/modules/identity';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import {
  ADMINISTRATORS_LABEL,
  BRAND_LABEL,
  NAV_SECTION_PLATFORM,
} from '@/lib/shared/navigation/private-nav';

import {
  AdministratorListSection,
  AdministratorTable,
  loadActiveCompanies,
  parseAdministratorListParams,
  type AdministratorListSearchParams,
} from './components';

export const metadata: Metadata = {
  title: `${ADMINISTRATORS_LABEL} · ${BRAND_LABEL}`,
};

const PERMISO_DENEGADO = new Error('permiso denegado');

// Solo decide qué se pinta: quien autoriza la escritura es el caso de uso.
async function canModifyAdministrators(): Promise<boolean> {
  const user = await identity.getSessionUser();
  try {
    assertPermission(user, 'empresas.modificar', () => PERMISO_DENEGADO);
    return true;
  } catch (error) {
    if (error !== PERMISO_DENEGADO) throw error;
    return false;
  }
}

export default async function MaestroAdministradoresPage({
  searchParams,
}: {
  searchParams: Promise<AdministratorListSearchParams>;
}) {
  await requirePagePermission('empresas.consultar');

  const resolved = await searchParams;
  const canModify = await canModifyAdministrators();
  const params = parseAdministratorListParams(resolved);
  const companies = await loadActiveCompanies();

  const header = (
    <PageHeader
      title={ADMINISTRATORS_LABEL}
      titleTestId="maestro-administradores-title"
      breadcrumb={{
        label: NAV_SECTION_PLATFORM,
        items: [{ label: NAV_SECTION_PLATFORM }, { label: ADMINISTRATORS_LABEL }],
      }}
    />
  );

  // Sin las empresas no hay filtro ni alta posibles: la lista se queda en su error.
  if (companies.status === 'error') {
    return (
      <PageShell>
        {header}
        <AdministratorTable
          status="error"
          error={companies}
          administrators={[]}
          companies={[]}
          params={params}
          total={0}
          totalPages={0}
          canModify={canModify}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {header}
      <Suspense
        fallback={
          <AdministratorTable
            status="loading"
            administrators={[]}
            companies={companies.companies}
            params={params}
            total={0}
            totalPages={0}
            canModify={canModify}
          />
        }
      >
        <AdministratorListSection
          params={params}
          companies={companies.companies}
          canModify={canModify}
        />
      </Suspense>
    </PageShell>
  );
}
