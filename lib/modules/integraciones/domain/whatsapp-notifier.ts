export type WhatsappTemplateRef = { readonly name: string; readonly language: string };

export type WhatsappEnqueueSkipReason =
  | 'addon_off'
  | 'no_active_connection'
  | 'customer_not_found'
  | 'no_phone'
  | 'contact_linked_elsewhere'
  | 'contact_blocked'
  | 'template_not_found'
  | 'template_not_sendable'
  | 'template_values_missing'
  | 'error';

export type WhatsappEnqueueOutcome =
  | { readonly status: 'queued'; readonly messageId: string; readonly published: boolean }
  | { readonly status: 'skipped'; readonly reason: WhatsappEnqueueSkipReason };

/**
 * El aviso por WhatsApp de otro módulo. Escribe fuera de la transacción de quien llama: se llama
 * después de confirmar la operación de negocio, o el aviso sale aunque esa operación se revierta.
 */
export interface WhatsappNotifier {
  /** Nunca rechaza: un aviso que no sale no debe tumbar la operación que lo pidió. */
  enqueue(
    companyId: string,
    customerId: string,
    template: WhatsappTemplateRef,
    values: Readonly<Record<string, string>>,
  ): Promise<WhatsappEnqueueOutcome>;
}
