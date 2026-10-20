import type { Metadata } from 'next';

import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { BRAND_LABEL, CUSTOMER_CONTACTS_LABEL } from '@/lib/shared/navigation/private-nav';

import {
  CUSTOMER_CONTACTS_EMPTY_MESSAGE,
  CUSTOMER_CONTACTS_EMPTY_TESTID,
  CUSTOMER_CONTACTS_TITLE_TESTID,
} from './components';

export const metadata: Metadata = {
  title: `${CUSTOMER_CONTACTS_LABEL} · ${BRAND_LABEL}`,
};

export default async function CustomerContactsPage() {
  await requirePagePermission('clientes.consultar');

  return (
    <PageShell>
      <PageHeader title={CUSTOMER_CONTACTS_LABEL} titleTestId={CUSTOMER_CONTACTS_TITLE_TESTID} />
      <EmptyState testId={CUSTOMER_CONTACTS_EMPTY_TESTID} message={CUSTOMER_CONTACTS_EMPTY_MESSAGE} />
    </PageShell>
  );
}
