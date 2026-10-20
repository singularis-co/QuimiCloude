import type { Metadata } from 'next';

import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { getAiProviderConnectionAction } from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions';
import {
  AI_PROVIDER_INTEGRATION_LABEL,
  BRAND_LABEL,
  INTEGRATIONS_LABEL,
} from '@/lib/shared/navigation/private-nav';

import { AiProviderCard, AiProviderForm } from './components';

export const metadata: Metadata = {
  title: `${AI_PROVIDER_INTEGRATION_LABEL} · ${BRAND_LABEL}`,
};

const AI_PROVIDER_PAGE_TEXTS = {
  breadcrumb: 'Ruta',
  intro:
    'La lectura de fórmulas y catálogos en PDF usa la cuenta de IA de tu empresa. Elige el proveedor, pega tu API key y prueba la conexión. La key se guarda cifrada y nunca se vuelve a mostrar.',
  loadError: 'No se pudo cargar el proveedor IA.',
} as const;

const AI_PROVIDER_PAGE_ERROR_TESTID = 'ai-provider-page-error';

export default async function AiProviderIntegrationPage() {
  await requirePagePermission('integraciones.modificar');

  const result = await getAiProviderConnectionAction();

  return (
    <PageShell>
      <div className="flex flex-col gap-2">
        <PageHeader
          title={AI_PROVIDER_INTEGRATION_LABEL}
          titleTestId="integration-title"
          breadcrumb={{
            label: AI_PROVIDER_PAGE_TEXTS.breadcrumb,
            items: [{ label: INTEGRATIONS_LABEL }, { label: AI_PROVIDER_INTEGRATION_LABEL }],
          }}
        />
        <p className="max-w-[720px] text-sm text-muted-foreground">{AI_PROVIDER_PAGE_TEXTS.intro}</p>
      </div>
      {result.status === 'error' ? (
        <ErrorState
          error={result}
          title={AI_PROVIDER_PAGE_TEXTS.loadError}
          testId={AI_PROVIDER_PAGE_ERROR_TESTID}
          retry={{ kind: 'refresh' }}
          retryTestId={`${AI_PROVIDER_PAGE_ERROR_TESTID}-retry`}
        />
      ) : result.connection === null ? (
        <AiProviderForm providers={result.providers} />
      ) : (
        <AiProviderCard providers={result.providers} connection={result.connection} />
      )}
    </PageShell>
  );
}
