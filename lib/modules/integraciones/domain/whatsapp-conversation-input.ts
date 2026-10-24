import { z } from 'zod';

export const CONVERSATION_SEARCH_MAX_LENGTH = 100;
export const CHAT_DEFAULT_PAGE_SIZE = 30;
export const CHAT_MAX_PAGE_SIZE = 50;

// Los mismos números que `lib/shared/pagination`, que el dominio no puede importar; un test los ata.
export const CONVERSATIONS_DEFAULT_PAGE_SIZE = 10;
export const CONVERSATIONS_MAX_PAGE_SIZE = 25;

export const CONVERSATION_BLOCKED_FILTERS = ['all', 'blocked', 'not_blocked'] as const;
export type ConversationBlockedFilter = (typeof CONVERSATION_BLOCKED_FILTERS)[number];

export const listWhatsappConversationsSchema = z
  .object({
    search: z.string().max(CONVERSATION_SEARCH_MAX_LENGTH).default(''),
    blocked: z.enum(CONVERSATION_BLOCKED_FILTERS).default('all'),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).optional(),
  })
  .strict();

export type ListWhatsappConversationsInput = z.input<typeof listWhatsappConversationsSchema>;
export type ListWhatsappConversationsQuery = z.output<typeof listWhatsappConversationsSchema>;

export const getWhatsappChatSchema = z
  .object({
    target: z.union([z.object({ contactId: z.uuid() }).strict(), z.object({ customerId: z.uuid() }).strict()]),
    before: z.uuid().optional(),
    pageSize: z.number().int().min(1).optional(),
  })
  .strict();

export type GetWhatsappChatInput = z.input<typeof getWhatsappChatSchema>;
export type GetWhatsappChatQuery = z.output<typeof getWhatsappChatSchema>;

export const markWhatsappChatReadSchema = z
  .object({
    contactId: z.uuid(),
    upToMessageId: z.uuid().optional(),
  })
  .strict();

export type MarkWhatsappChatReadInput = z.input<typeof markWhatsappChatReadSchema>;

// Un tamaño por encima del tope se acota, no se rechaza: el mínimo ya lo exige el esquema.
export function conversationsPageSizeOf(pageSize: number | undefined): number {
  return Math.min(pageSize ?? CONVERSATIONS_DEFAULT_PAGE_SIZE, CONVERSATIONS_MAX_PAGE_SIZE);
}

export function chatPageSizeOf(pageSize: number | undefined): number {
  return Math.min(pageSize ?? CHAT_DEFAULT_PAGE_SIZE, CHAT_MAX_PAGE_SIZE);
}
