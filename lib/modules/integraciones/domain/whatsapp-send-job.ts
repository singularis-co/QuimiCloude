import { z } from 'zod';

export const WHATSAPP_SEND_JOB_KIND = 'send_message';

/**
 * La empresa viaja en el cuerpo porque la cola firma el cuerpo entero: no se puede cambiar sin
 * invalidar la firma, y así el consumidor lee con ámbito desde la primera consulta.
 */
export const whatsappSendJobSchema = z
  .object({
    kind: z.literal(WHATSAPP_SEND_JOB_KIND),
    messageId: z.uuid(),
    companyId: z.uuid(),
  })
  .strict();

export type WhatsappSendJob = z.infer<typeof whatsappSendJobSchema>;
