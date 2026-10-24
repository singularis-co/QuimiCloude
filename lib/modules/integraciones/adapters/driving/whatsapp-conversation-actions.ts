'use server';

/**
 * Server Actions de la consulta de conversaciones de WhatsApp. No deciden nada: resuelven el actor,
 * pasan la entrada tal cual al caso de uso (que la valida) y copian la vista campo a campo. No
 * revalidan ninguna ruta: solo leen, salvo la marca de lectura, que no pinta nada en otra pantalla.
 *
 * Se importa por su ruta exacta: un `'use server'` reexportado desde el barrel lo volvería
 * inimportable desde un componente de cliente.
 */

import { identity, integraciones, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  IntegracionesError,
  type Actor,
  type WhatsappChat,
  type WhatsappChatAttachment,
  type WhatsappChatMessage,
  type WhatsappConversationItem,
  type WhatsappConversationList,
  type WhatsappSendableTemplate,
  type WhatsappTemplateButton,
} from '@/lib/modules/integraciones';
import { runInRequestScope } from '@/lib/shared/request-scope';

type ActionResult<T> = { status: 'success'; data: T } | ErrorState;
type ChatTarget = { contactId: string } | { customerId: string };

export type WhatsappConversationListResult = ActionResult<WhatsappConversationList>;
export type WhatsappChatResult = ActionResult<WhatsappChat>;
export type WhatsappChatReadResult = ActionResult<{ unreadCount: number }>;
export type WhatsappSendableTemplatesResult = ActionResult<{ templates: readonly WhatsappSendableTemplate[] }>;

const toErrorState = createErrorStateTranslator(IntegracionesError, observabilidad.readRequestIdHeader);

async function currentActor(): Promise<Actor | null> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    permissions: sessionUser.permissions,
  };
}

async function run<T>(operation: (actor: Actor | null) => Promise<T>): Promise<ActionResult<T>> {
  const actor = await currentActor();
  try {
    return { status: 'success', data: await operation(actor) };
  } catch (error) {
    return toErrorState(error);
  }
}

function conversationItemOf(item: WhatsappConversationItem): WhatsappConversationItem {
  return {
    contactId: item.contactId,
    customerId: item.customerId,
    customerName: item.customerName,
    phone: item.phone,
    isBlocked: item.isBlocked,
    unreadCount: item.unreadCount,
    lastMessage: {
      direction: item.lastMessage.direction,
      type: item.lastMessage.type,
      preview: item.lastMessage.preview,
      status: item.lastMessage.status,
      at: item.lastMessage.at,
    },
  };
}

function attachmentOf(attachment: WhatsappChatAttachment | null): WhatsappChatAttachment | null {
  if (attachment === null) return null;
  if (attachment.kind === 'media') {
    return {
      kind: 'media',
      mimeType: attachment.mimeType,
      filename: attachment.filename,
      caption: attachment.caption,
      mediaUrl: attachment.mediaUrl,
    };
  }
  if (attachment.kind === 'location') {
    return {
      kind: 'location',
      latitude: attachment.latitude,
      longitude: attachment.longitude,
      name: attachment.name,
      address: attachment.address,
    };
  }
  return { kind: 'reaction', emoji: attachment.emoji, messageId: attachment.messageId };
}

function chatMessageOf(message: WhatsappChatMessage): WhatsappChatMessage {
  return {
    id: message.id,
    direction: message.direction,
    type: message.type,
    body: message.body,
    attachment: attachmentOf(message.attachment),
    status: message.status,
    errorReason: message.errorReason,
    origin: message.origin,
    sentBy: message.sentBy === null ? null : { id: message.sentBy.id, displayName: message.sentBy.displayName },
    templateName: message.templateName,
    at: message.at,
  };
}

function chatOf(chat: WhatsappChat): WhatsappChat {
  return {
    connectionStatus: chat.connectionStatus,
    contact:
      chat.contact === null
        ? null
        : {
            id: chat.contact.id,
            phone: chat.contact.phone,
            isBlocked: chat.contact.isBlocked,
            unreadCount: chat.contact.unreadCount,
          },
    customer: { id: chat.customer.id, name: chat.customer.name },
    window: chat.window.open ? { open: true, closesAt: chat.window.closesAt } : { open: false, closesAt: null },
    messages: chat.messages.map(chatMessageOf),
    hasMore: chat.hasMore,
    nextCursor: chat.nextCursor,
  };
}

function buttonOf(button: WhatsappTemplateButton): WhatsappTemplateButton {
  if (button.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: button.text };
  if (button.type === 'URL') return { type: 'URL', text: button.text, url: button.url, example: button.example };
  return { type: 'PHONE_NUMBER', text: button.text, phoneNumber: button.phoneNumber };
}

function sendableTemplateOf(template: WhatsappSendableTemplate): WhatsappSendableTemplate {
  const { header, body, footer, buttons } = template.content;
  return {
    id: template.id,
    name: template.name,
    language: template.language,
    category: template.category,
    content: {
      header: header === null ? null : { text: header.text, example: header.example },
      body: { text: body.text, examples: [...body.examples] },
      footer,
      buttons: buttons.map(buttonOf),
    },
    variables: template.variables.map((variable) => ({
      slot: variable.slot,
      position: variable.position,
      kind: variable.kind,
      key: variable.key,
      label: variable.label,
      value: variable.value,
    })),
  };
}

export async function listWhatsappConversationsAction(input: {
  search?: string;
  blocked?: 'all' | 'blocked' | 'not_blocked';
  page?: number;
  pageSize?: number;
}): Promise<WhatsappConversationListResult> {
  return run(async (actor) => {
    const list = await integraciones.listWhatsappConversations(input, actor);
    return {
      connectionStatus: list.connectionStatus,
      page: {
        items: list.page.items.map(conversationItemOf),
        total: list.page.total,
        page: list.page.page,
        pageSize: list.page.pageSize,
        totalPages: list.page.totalPages,
      },
    };
  });
}

/** Leer el chat no lo marca leído: eso es `markWhatsappChatReadAction`. */
export async function getWhatsappChatAction(input: {
  target: ChatTarget;
  before?: string;
  pageSize?: number;
}): Promise<WhatsappChatResult> {
  return run(async (actor) => chatOf(await integraciones.getWhatsappChat(input, actor)));
}

export async function markWhatsappChatReadAction(input: {
  contactId: string;
  upToMessageId?: string;
}): Promise<WhatsappChatReadResult> {
  return run(async (actor) => {
    const { unreadCount } = await integraciones.markWhatsappChatRead(input, actor);
    return { unreadCount };
  });
}

export async function listSendableWhatsappTemplatesAction(): Promise<WhatsappSendableTemplatesResult> {
  return run(async (actor) => {
    const { templates } = await integraciones.listSendableWhatsappTemplates(actor);
    return { templates: templates.map(sendableTemplateOf) };
  });
}
