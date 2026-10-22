/** Servicio de `clientes`: recibe la empresa y no un ámbito de este módulo. */
export interface CustomerPhoneLinks {
  /** `numbers`: los números añadidos al cliente, para recalcular los contactos que los comparten. */
  addWaId(
    customerId: string,
    waId: string,
    actorId: string,
    now: Date,
    companyId: string,
  ): Promise<'customer_not_found' | 'invalid_number' | { readonly numbers: readonly string[] }>;
  /** `numbers`: los números quitados al cliente. */
  removeWaId(
    customerId: string,
    waId: string,
    actorId: string,
    now: Date,
    companyId: string,
  ): Promise<{ readonly numbers: readonly string[] }>;
}
