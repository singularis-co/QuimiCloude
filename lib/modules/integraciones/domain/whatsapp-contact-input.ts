import { z } from 'zod';

const idSchema = z.string().uuid();

export const linkWhatsappContactSchema = z.object({ contactId: idSchema, customerId: idSchema });

export const unlinkWhatsappContactSchema = z.object({ contactId: idSchema });

export const setWhatsappContactBlockedSchema = z.object({ contactId: idSchema, blocked: z.boolean() });

export type LinkWhatsappContactInput = z.infer<typeof linkWhatsappContactSchema>;
export type UnlinkWhatsappContactInput = z.infer<typeof unlinkWhatsappContactSchema>;
export type SetWhatsappContactBlockedInput = z.infer<typeof setWhatsappContactBlockedSchema>;
