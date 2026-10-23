import { z } from 'zod';

export const WHATSAPP_TEXT_MAX_LENGTH = 4096;

function lengthOf(text: string): number {
  return [...text].length;
}

const recipient = z.union([
  z.object({ contactId: z.uuid() }).strict(),
  z.object({ customerId: z.uuid() }).strict(),
]);

const text = z
  .string()
  .refine((value) => value.trim() !== '')
  .refine((value) => lengthOf(value) <= WHATSAPP_TEXT_MAX_LENGTH);

const templateValues = {
  constants: z.record(z.string(), z.string()).default({}),
  constantLabels: z.record(z.string(), z.string()).default({}),
};

export const sendWhatsappMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), recipient, text }),
  z.object({ kind: z.literal('template'), recipient, templateId: z.uuid(), ...templateValues }),
]);

export const retryWhatsappMessageSchema = z.object({ messageId: z.uuid(), ...templateValues });

export type SendWhatsappMessageInput = z.infer<typeof sendWhatsappMessageSchema>;
export type RetryWhatsappMessageInput = z.infer<typeof retryWhatsappMessageSchema>;
export type WhatsappSendRecipient = z.infer<typeof recipient>;
