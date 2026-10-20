/** `linkedBy` no nulo marca el vínculo como elegido por ese usuario; nulo, como puesto por el sistema. */
export type ContactLink = { readonly customerId: string | null; readonly linkedBy: string | null };

/** `owners`: los clientes vivos de la empresa con un teléfono vivo que coincide con el número. */
export function resolveContactLink(current: ContactLink, owners: readonly string[]): ContactLink {
  if (current.customerId !== null && current.linkedBy !== null && owners.includes(current.customerId)) {
    return current;
  }
  const [only] = owners;
  if (owners.length === 1 && only !== undefined) return { customerId: only, linkedBy: null };
  return { customerId: null, linkedBy: null };
}

export function sameContactLink(a: ContactLink, b: ContactLink): boolean {
  return a.customerId === b.customerId && a.linkedBy === b.linkedBy;
}
