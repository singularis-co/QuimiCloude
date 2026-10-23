/** Servicio de `clientes`: recibe la empresa y no un ámbito de este módulo. */
export interface CustomerPhoneOwners {
  /** Los clientes vivos de la empresa con un teléfono vivo que coincide con `waId`. */
  ownersOf(waId: string, companyId: string): Promise<readonly string[]>;
}
