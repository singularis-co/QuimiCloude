import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { formatPhoneInternational } from '@/lib/modules/clientes';
import { getCustomerAction } from '@/lib/modules/clientes/adapters/driving/customer-actions';
import { assertPermission, type PermissionCode } from '@/lib/modules/identity';
import { currentPlatformActor } from '@/lib/modules/identity/adapters/driving/platform-session';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import {
  getWhatsappChatAction,
  getWhatsappChatContextAction,
  listSendableWhatsappTemplatesAction,
  listWhatsappConversationsAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions';
import {
  BRAND_LABEL,
  CUSTOMER_CONTACTS_LABEL,
  PRIVATE_NAV_ITEMS,
  filterNavItemsByPermissions,
} from '@/lib/shared/navigation/private-nav';
import { WHATSAPP_INTEGRATION_ROUTE } from '@/lib/shared/routes';

import {
  CHAT_PAGE_SIZE,
  CONVERSATIONS_PAGE_SIZE,
  CUSTOMER_CONTACTS_TITLE_TESTID,
  ContactsLoadError,
  ContactsNotConnected,
  ContactsScreen,
  selectionFromSearch,
  type ContactsScreenProps,
} from './components';

export const metadata: Metadata = {
  title: `${CUSTOMER_CONTACTS_LABEL} · ${BRAND_LABEL}`,
};

type ContactsSearchParams = Record<string, string | string[] | undefined>;

const PERMISSION_DENIED = new Error('permiso denegado');

// Presentación, no autorización: quien autoriza es cada Server Action.
async function sessionHolds(permission: PermissionCode): Promise<boolean> {
  const actor = await currentPlatformActor();
  try {
    assertPermission(actor, permission, () => PERMISSION_DENIED);
    return true;
  } catch (error) {
    if (error !== PERMISSION_DENIED) throw error;
    return false;
  }
}

// R3: el enlace se ve con el mismo permiso que el menu exige para esa pantalla.
async function sessionSeesNavLink(href: string): Promise<boolean> {
  const actor = await currentPlatformActor();
  const visibles = filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, actor?.permissions ?? []);
  return visibles.some((item) => (item.kind === 'link' ? item.href === href : item.items.some((hijo) => hijo.href === href)));
}

function firstValue(params: ContactsSearchParams, name: string): string | null {
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

async function loadRequestedCustomer(customerId: string): Promise<ContactsScreenProps['requestedCustomer']> {
  const result = await getCustomerAction(customerId);
  if (result.status !== 'success') return null;
  const { phoneE164, phoneIssue } = result.data;
  if (phoneE164 === null || phoneIssue !== null) return null;
  return { id: customerId, phone: formatPhoneInternational(phoneE164) };
}

export default async function CustomerContactsPage({
  searchParams,
}: {
  searchParams: Promise<ContactsSearchParams>;
}) {
  await requirePagePermission('whatsapp.consultar');

  const params = await searchParams;
  const selection = selectionFromSearch({ get: (name) => firstValue(params, name) });
  const requestedCustomerId = selection !== null && 'customerId' in selection ? selection.customerId : null;

  const [canSend, canOpenIntegrations, list, templates, chat, context, requestedCustomer] = await Promise.all([
    sessionHolds('whatsapp.enviar'),
    sessionSeesNavLink(WHATSAPP_INTEGRATION_ROUTE),
    listWhatsappConversationsAction({ page: 1, pageSize: CONVERSATIONS_PAGE_SIZE }),
    listSendableWhatsappTemplatesAction(),
    selection === null ? null : getWhatsappChatAction({ target: selection, pageSize: CHAT_PAGE_SIZE }),
    selection === null ? null : getWhatsappChatContextAction({ target: selection }),
    requestedCustomerId === null ? null : loadRequestedCustomer(requestedCustomerId),
  ]);

  let content;
  if (list.status !== 'success') content = <ContactsLoadError error={list} />;
  else if (list.data.connectionStatus === null) content = <ContactsNotConnected canOpenIntegrations={canOpenIntegrations} />;
  else if (templates.status !== 'success') content = <ContactsLoadError error={templates} />;
  else
    content = (
      <ContactsScreen
        initialPage={list.data.page}
        initialSelection={selection}
        initialChat={chat}
        initialContext={context}
        templates={templates.data.templates}
        canSend={canSend}
        requestedCustomer={requestedCustomer}
        className="min-h-0 flex-1"
      />
    );

  return (
    <PageShell className="h-[calc(100dvh-3.5rem)] min-h-0">
      <PageHeader title={CUSTOMER_CONTACTS_LABEL} titleTestId={CUSTOMER_CONTACTS_TITLE_TESTID} />
      {content}
    </PageShell>
  );
}
