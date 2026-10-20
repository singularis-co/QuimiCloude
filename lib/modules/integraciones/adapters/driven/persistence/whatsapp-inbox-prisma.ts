import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { INBOUND_MESSAGE_DIRECTION, INBOUND_MESSAGE_STATUS } from '../../../domain/whatsapp-message';
import { STATUS_PREDECESSORS } from '../../../domain/whatsapp-message-status';

import {
  companyScopeColumns,
  whatsappConnectionCompanyScope,
  whatsappMessageCompanyScope,
} from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { InboundBatch, InboundContact, InboundStatus } from '../../../domain/whatsapp-webhook-payload';

/**
 * Una sola sentencia por contacto: dos webhooks simultáneos del mismo número no pueden duplicarlo
 * ni hacer retroceder sus fechas, y un lote más viejo no pisa el nombre de perfil.
 */
async function upsertContact(
  tx: Prisma.TransactionClient,
  contact: InboundContact,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<string> {
  const { companyId } = companyScopeColumns(scope);
  const rows = await tx.$queryRaw<ReadonlyArray<{ id: string }>>(Prisma.sql`
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
    RETURNING id`);
  const row = rows[0];
  if (row === undefined) throw new Error('El contacto de WhatsApp pertenece a otra empresa.');
  return row.id;
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
  batch: InboundBatch,
  connectionId: string,
  receivedAt: Date,
  scope: IntegracionesScope,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const contactIds = new Map<string, string>();
    for (const contact of batch.contacts) {
      contactIds.set(contact.waId, await upsertContact(tx, contact, connectionId, scope));
    }

    if (batch.messages.length > 0) {
      await tx.whatsappMessage.createMany({
        data: batch.messages.map((message) => {
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
  });
}
