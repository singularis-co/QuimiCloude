import type { WhatsappMessageDirection, WhatsappMessageOrigin, WhatsappMessageStatus } from './whatsapp-message';

export type OutboundMessageType = 'TEXT' | 'TEMPLATE';

export type OutboundContact = {
  readonly id: string;
  readonly waId: string;
  readonly customerId: string | null;
  readonly customerLinkedBy: string | null;
  readonly blockedAt: Date | null;
  readonly lastInboundAt: Date | null;
};

export type NewOutboundMessage = {
  readonly connectionId: string;
  readonly contactId: string;
  readonly sentById: string;
  readonly type: OutboundMessageType;
  readonly body: string;
  readonly templateName: string | null;
  readonly templateLanguage: string | null;
  readonly payload: Record<string, unknown>;
};

export type OutboundMessageRecord = NewOutboundMessage & {
  readonly id: string;
  readonly status: WhatsappMessageStatus;
  readonly direction: WhatsappMessageDirection;
  readonly origin: WhatsappMessageOrigin;
  readonly errorCode: string | null;
  readonly errorReason: string | null;
  readonly createdAt: Date;
};

export type WhatsappOutboundMessageView = {
  readonly id: string;
  readonly type: OutboundMessageType;
  readonly status: 'SENT' | 'FAILED';
  readonly body: string;
  readonly templateName: string | null;
  readonly templateLanguage: string | null;
  readonly errorCode: string | null;
  readonly errorReason: string | null;
  readonly createdAt: string;
};
