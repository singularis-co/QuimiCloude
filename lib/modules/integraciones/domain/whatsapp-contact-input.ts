import { z } from 'zod';

import {
  LinkedCustomerNotFoundError,
  ValidationError,
  WhatsappContactNotFoundError,
  type IntegracionesError,
} from './errors';

const idSchema = z.string().uuid();

export const linkWhatsappContactSchema = z.object({ contactId: idSchema, customerId: idSchema });

export const unlinkWhatsappContactSchema = z.object({ contactId: idSchema });

export const setWhatsappContactBlockedSchema = z.object({ contactId: idSchema, blocked: z.boolean() });

export type LinkWhatsappContactInput = z.infer<typeof linkWhatsappContactSchema>;
export type UnlinkWhatsappContactInput = z.infer<typeof unlinkWhatsappContactSchema>;
export type SetWhatsappContactBlockedInput = z.infer<typeof setWhatsappContactBlockedSchema>;

/**
 * Un id sin forma de uuid no puede existir, así que responde como no encontrado; lo demás es entrada
 * inválida. Se mira el primer campo que falla, en el orden del esquema.
 */
export function contactInputError(error: z.ZodError): IntegracionesError {
  const field = error.issues[0]?.path[0];
  if (field === 'contactId') return new WhatsappContactNotFoundError();
  if (field === 'customerId') return new LinkedCustomerNotFoundError();
  return new ValidationError();
}
