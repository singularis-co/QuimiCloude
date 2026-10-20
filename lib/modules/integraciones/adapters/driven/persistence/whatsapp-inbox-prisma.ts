import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { resolveContactLink, sameContactLink, type ContactLink } from '../../../domain/whatsapp-contact-link';
import { INBOUND_MESSAGE_DIRECTION, INBOUND_MESSAGE_STATUS } from '../../../domain/whatsapp-message';
import { STATUS_PREDECESSORS } from '../../../domain/whatsapp-message-status';

import {
  companyScopeColumns,
  whatsappConnectionCompanyScope,
  whatsappContactCompanyScope,
  whatsappMessageCompanyScope,
} from './company-scope';
import { setWhatsappContactLink } from './whatsapp-contact-prisma';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { InboundBatch, InboundContact, InboundStatus } from '../../../domain/whatsapp-webhook-payload';
import type { CustomerPhoneOwners } from '../../../ports/customer-phone-owners';
import type { WhatsappInboxRecordResult, WhatsappInboxRepository } from '../../../ports/whatsapp-inbox-repository';

export type WhatsappInboxRecorderDeps = {
  /** Los dueños de un número se leen por la misma transacción que guarda el lote. */
  readonly ownersOn: (tx: Prisma.TransactionClient) => CustomerPhoneOwners;
};

type UpsertedContact = { readonly id: string; readonly link: ContactLink };

type UpsertedContactRow = {
  readonly id: string;
  readonly customer_id: string | null;
  readonly customer_linked_by: string | null;
};

/**
 * Una sola sentencia por contacto: dos webhooks simultáneos del mismo número no pueden duplicarlo
 * ni hacer retroceder sus fechas, y un lote más viejo no pisa el nombre de perfil.
 */
async function upsertContact(
  tx: Prisma.TransactionClient,
  contact: InboundContact,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<UpsertedContact> {
  const { companyId } = companyScopeColumns(scope);
  const rows = await tx.$queryRaw<ReadonlyArray<UpsertedContactRow>>(Prisma.sql`
    INSERT INTO whatsapp_contacts (company_id, connection_id, wa_id, profile_name,
                                   last_inbound_at, last_message_at, updated_at)
    VALUES (${companyId}::uuid, ${connectionId}::uuid, ${contact.waId}, ${contact.profileName}::text,
            ${contact.latestAt}::timestamptz, ${contact.latestAt}::timestamptz, now())
    ON CONFLICT (connection_id, wa_id) DO UPDATE SET
      profile_name    = CASE WHEN EXCLUDED.last_inbound_at >= COALESCE(whatsapp_contacts.last_inbound_at, '-infinity')
                             THEN COALESCE(EXCLUDED.profile_name, whatsapp_contacts.profile_name)
                             ELSE whatsapp_contacts.profile_name END,
      last_inbound_at = GREATEST(whatsapp_contacts.last_inbound_at, EXCLUDED.last_inbound_at),
      last_message_at = GREATEST(whatsapp_contacts.last_message_at, EXCLUDED.last_message_at),
      updated_at      = now()
    WHERE whatsapp_contacts.company_id = EXCLUDED.company_id
    RETURNING id, customer_id, customer_linked_by`);
  const row = rows[0];
  if (row === undefined) throw new Error('El contacto de WhatsApp pertenece a otra empresa.');
  return { id: row.id, link: { customerId: row.customer_id, linkedBy: row.customer_linked_by } };
}

async function findBlockedWaIds(
  tx: Prisma.TransactionClient,
  connectionId: string,
  waIds: readonly string[],
  scope: IntegracionesScope,
): Promise<ReadonlySet<string>> {
  if (waIds.length === 0) return new Set();
  const rows = await tx.whatsappContact.findMany({
    where: { connectionId, waId: { in: [...waIds] }, blockedAt: { not: null }, ...whatsappContactCompanyScope(scope) },
    select: { waId: true },
  });
  return new Set(rows.map((row) => row.waId));
}

async function applyLinkRule(
  tx: Prisma.TransactionClient,
  owners: CustomerPhoneOwners,
  contact: UpsertedContact,
  waId: string,
  scope: IntegracionesScope,
): Promise<void> {
  const { companyId } = companyScopeColumns(scope);
  const next = resolveContactLink(contact.link, await owners.ownersOf(waId, companyId));
  if (!sameContactLink(next, contact.link)) await setWhatsappContactLink(tx, contact.id, next, scope);
}

/** La condición de orden va en el `where`: dos statuses concurrentes no pueden hacerlo retroceder. */
async function applyStatus(
  tx: Prisma.TransactionClient,
  status: InboundStatus,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<void> {
  const failed = status.status === 'FAILED';
  await tx.whatsappMessage.updateMany({
    where: {
      wamid: status.wamid,
      connectionId,
      status: { in: [...STATUS_PREDECESSORS[status.status]] },
      ...whatsappMessageCompanyScope(scope),
    },
    data: failed
      ? { status: status.status, errorCode: status.errorCode, errorReason: status.errorReason }
      : { status: status.status },
  });
}

export async function recordWhatsappInbound(
  deps: WhatsappInboxRecorderDeps,
  batch: InboundBatch,
  connectionId: string,
  receivedAt: Date,
  scope: IntegracionesScope,
): Promise<WhatsappInboxRecordResult> {
  return prisma.$transaction(async (tx) => {
    const senders = [...new Set([...batch.contacts, ...batch.messages].map((item) => item.waId))];
    const blocked = await findBlockedWaIds(tx, connectionId, senders, scope);
    const owners = deps.ownersOn(tx);

    const contactIds = new Map<string, string>();
    for (const contact of batch.contacts) {
      if (blocked.has(contact.waId)) continue;
      const upserted = await upsertContact(tx, contact, connectionId, scope);
      await applyLinkRule(tx, owners, upserted, contact.waId, scope);
      contactIds.set(contact.waId, upserted.id);
    }

    const messages = batch.messages.filter((message) => !blocked.has(message.waId));
    if (messages.length > 0) {
      await tx.whatsappMessage.createMany({
        data: messages.map((message) => {
          const contactId = contactIds.get(message.waId);
          if (contactId === undefined) throw new Error('Mensaje de WhatsApp sin contacto en el lote.');
          return {
            ...companyScopeColumns(scope),
            connectionId,
            contactId,
            direction: INBOUND_MESSAGE_DIRECTION,
            status: INBOUND_MESSAGE_STATUS,
            wamid: message.wamid,
            type: message.type,
            body: message.body,
            payload: message.payload as Prisma.InputJsonObject,
            metaTimestamp: message.metaTimestamp,
          };
        }),
        skipDuplicates: true,
      });
    }

    for (const status of batch.statuses) {
      await applyStatus(tx, status, connectionId, scope);
    }

    await tx.whatsappConnection.updateMany({
      where: { id: connectionId, deletedAt: null, ...whatsappConnectionCompanyScope(scope) },
      data: { lastWebhookAt: receivedAt },
    });

    return { discardedBlocked: batch.messages.length - messages.length };
  });
}

/** Fábrica y no objeto ya construido: los dueños los da quien conoce el módulo `clientes`. */
export function createWhatsappInboxRecorder(deps: WhatsappInboxRecorderDeps): WhatsappInboxRepository {
  return {
    record: (batch, connectionId, receivedAt, scope) =>
      recordWhatsappInbound(deps, batch, connectionId, receivedAt, scope),
  };
}
