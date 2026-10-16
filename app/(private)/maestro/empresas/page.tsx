import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { identity } from '@/lib/composition';
import { assertPermission } from '@/lib/modules/identity';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import {
  BRAND_LABEL,
  COMPANIES_LABEL,
  NAV_SECTION_PLATFORM,
} from '@/lib/shared/navigation/private-nav';

import {
  CompanyListSection,
  CompanyTable,
  parseCompanyListParams,
  type CompanyListSearchParams,
} from './components';

export const metadata: Metadata = {
  title: `${COMPANIES_LABEL} · ${BRAND_LABEL}`,
};

const PERMISO_DENEGADO = new Error('permiso denegado');

// Solo decide qué se pinta: quien autoriza la escritura es el caso de uso.
async function canModifyCompanies(): Promise<boolean> {
  const user = await identity.getSessionUser();
  try {
    assertPermission(user, 'empresas.modificar', () => PERMISO_DENEGADO);
    return true;
  } catch (error) {
    if (error !== PERMISO_DENEGADO) throw error;
    return false;
  }
}

export default async function MaestroEmpresasPage({
  searchParams,
}: {
  searchParams: Promise<CompanyListSearchParams>;
}) {
  await requirePagePermission('empresas.consultar');

  const resolved = await searchParams;
  const canModify = await canModifyCompanies();
  const params = parseCompanyListParams(resolved);

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
      {/* Sin `key`: remontar el límite en cada búsqueda se llevaría el foco de la caja. */}
      <Suspense
        fallback={
          <CompanyTable
            status="loading"
            companies={[]}
            params={params}
            total={0}
            totalPages={0}
            canModify={canModify}
          />
        }
      >
        <CompanyListSection params={params} canModify={canModify} />
      </Suspense>
    </PageShell>
  );
}
