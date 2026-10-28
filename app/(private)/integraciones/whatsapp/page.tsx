import type { Metadata } from 'next';

import { ErrorAlert } from '@/components/shared/error-alert';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import {
  getWhatsappConnectionAction,
  type WhatsappConnectionQueryResult,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-connection-actions';
import { listWhatsappTemplatesAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';
import { listWhatsappDictionaryAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions';
import { BRAND_LABEL, WHATSAPP_INTEGRATION_LABEL } from '@/lib/shared/navigation/private-nav';

import {
  WhatsappConnectionActions,
  WhatsappConnectionCard,
  WhatsappConnectionForm,
  WhatsappIntegrationTabs,
  WhatsappSetupGuide,
  WhatsappWebhookPanel,
} from './components';

export const metadata: Metadata = {
  title: `${WHATSAPP_INTEGRATION_LABEL} · ${BRAND_LABEL}`,
};

function isConnected(result: WhatsappConnectionQueryResult): boolean {
  return result.status === 'success' && result.data !== null;
}

export default async function WhatsappIntegrationPage() {
  await requirePagePermission('integraciones.modificar');

  const [{ result, templates }, dictionary] = await Promise.all([
    getWhatsappConnectionAction().then(async (connection) => ({
      result: connection,
      templates: isConnected(connection) ? await listWhatsappTemplatesAction() : null,
    })),
    listWhatsappDictionaryAction(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 data-testid="integration-title" className="text-2xl font-semibold">
        {WHATSAPP_INTEGRATION_LABEL}
      </h1>
      <WhatsappIntegrationTabs
        hasConnection={isConnected(result)}
        templates={templates}
        dictionary={dictionary}
      >
        {result.status === 'error' ? (
          <ErrorAlert
            error={result}
            className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
            testId="whatsapp-page-error"
            withDataCode
          />
        ) : result.data === null || result.webhook === null ? (
          <>
            <WhatsappSetupGuide />
            <WhatsappConnectionForm mode="create" />
          </>
        ) : (
          <>
            <WhatsappConnectionCard connection={result.data} />
            <WhatsappWebhookPanel webhook={result.webhook} />
            <WhatsappConnectionActions connection={result.data} />
          </>
        )}
      </WhatsappIntegrationTabs>
    </div>
  );
}
