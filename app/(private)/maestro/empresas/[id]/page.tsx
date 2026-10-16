import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { UrlTabs } from '@/components/shared/url-tabs';
import { identity } from '@/lib/composition';
import type { ErrorCode } from '@/lib/modules/errores';
import { assertPermission } from '@/lib/modules/identity';
import { getCompanyAction } from '@/lib/modules/identity/adapters/driving/company-actions';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { BRAND_LABEL, COMPANIES_LABEL } from '@/lib/shared/navigation/private-nav';
import { MAESTRO_COMPANIES_ROUTE } from '@/lib/shared/routes';

import {
  COMPANY_DETAIL_BREADCRUMB_NAV_LABEL,
  COMPANY_DETAIL_TABS_LABEL,
  COMPANY_DETAIL_TABS_TESTID,
  COMPANY_DETAIL_TAB_LABELS,
  CompanyDataPanel,
  CompanyDetailHeader,
  CompanyHistoryPanel,
  CompanyHistorySkeleton,
  companyDetailPanelTestId,
  companyDetailTabItems,
  isCompanyId,
  parseCompanyDetailParams,
  type CompanyDetailSearchParams,
} from './components';

export const metadata: Metadata = {
  title: `${COMPANIES_LABEL} · ${BRAND_LABEL}`,
};

const COMPANY_NOT_FOUND_CODE = 'company_not_found' satisfies ErrorCode;

const DETAIL_ERROR_TITLE = 'No se pudo cargar la empresa.';
const DETAIL_FALLBACK_TITLE = 'Empresa';

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

// La ficha se lee antes de pintar nada para que una empresa que no existe responda 404 y no 200.
export default async function MaestroEmpresaPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<CompanyDetailSearchParams>;
}) {
  await requirePagePermission('empresas.consultar');

  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isCompanyId(id)) notFound();

  const result = await getCompanyAction(id);
  if (result.status === 'error') {
    if (result.code === COMPANY_NOT_FOUND_CODE) notFound();
    return (
      <PageShell>
        <PageHeader
          title={DETAIL_FALLBACK_TITLE}
          breadcrumb={{
            label: COMPANY_DETAIL_BREADCRUMB_NAV_LABEL,
            items: [
              { label: COMPANIES_LABEL, href: MAESTRO_COMPANIES_ROUTE },
              { label: DETAIL_FALLBACK_TITLE },
            ],
          }}
        />
        <ErrorState
          error={result}
          title={DETAIL_ERROR_TITLE}
          testId="company-detail-error"
          retry={{ kind: 'refresh' }}
          retryTestId="company-detail-retry"
        />
      </PageShell>
    );
  }

  const company = result.data;
  const canModify = await canModifyCompanies();
  const { tab, historyPage } = parseCompanyDetailParams(query);

  return (
    <PageShell>
      <CompanyDetailHeader company={company} canModify={canModify} />
      <UrlTabs
        label={COMPANY_DETAIL_TABS_LABEL}
        testId={COMPANY_DETAIL_TABS_TESTID}
        current={tab}
        items={companyDetailTabItems(company.id)}
      />
      <div
        role="tabpanel"
        aria-label={COMPANY_DETAIL_TAB_LABELS[tab]}
        data-testid={companyDetailPanelTestId(tab)}
        className="min-w-0"
      >
        {tab === 'datos' ? <CompanyDataPanel company={company} /> : null}
        {tab === 'historial' ? (
          <Suspense key={historyPage} fallback={<CompanyHistorySkeleton />}>
            <CompanyHistoryPanel companyId={company.id} page={historyPage} />
          </Suspense>
        ) : null}
        {/* Módulos se deja vacía: su contenido se monta aquí y es quien pedirá los añadidos. */}
      </div>
    </PageShell>
  );
}
