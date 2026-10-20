import { formatPhoneInternational, parseWaIdPhone } from './customer-phone';
import type { CustomerScope } from './customer-scope';
import { phoneMatchesWaId } from './phone-matches-wa-id';

import type { CustomerPhoneRepository } from '../ports/customer-phone-repository';

/*
 * Orquestacion de los telefonos de un cliente. Ninguna funcion valida permisos: las llaman casos
 * de uso que ya lo hicieron. Todas devuelven los numeros que el cliente gano o perdio, que son los
 * que el llamante recalcula.
 */

/**
 * Deja `e164` como principal. El principal anterior pasa a secundario, no se quita: el cliente
 * sigue siendo dueno de ese numero y sus contactos conservan el vinculo. Degradar va antes de
 * promover o crear porque la base admite un solo principal vivo por cliente.
 */
export async function syncMainPhone(
  phones: CustomerPhoneRepository,
  customerId: string,
  e164: string | null,
  now: Date,
  scope: CustomerScope,
): Promise<readonly string[]> {
  const links = await phones.listAliveLinks(customerId, scope);
  const main = links.find((link) => link.main);
  if (e164 === (main?.e164 ?? null)) return [];

  if (e164 === null) {
    if (main === undefined) return [];
    await phones.removeLinks([main.linkId], now, scope);
    return [main.e164];
  }

  if (main !== undefined) await phones.setMain(main.linkId, false, now, scope);

  const secondary = links.find((link) => !link.main && link.e164 === e164);
  if (secondary !== undefined) {
    await phones.setMain(secondary.linkId, true, now, scope);
    return [];
  }

  await phones.addLink(customerId, e164, true, now, scope);
  return [e164];
}

export type WaIdChange = {
  readonly customerId: string;
  readonly waId: string;
  readonly actorId: string;
  readonly now: Date;
};

/**
 * Anade el numero de un contacto a los telefonos del cliente, salvo que ya tenga uno que coincida.
 * Sin principal, el numero entra como principal y reemplaza lo que el cliente mostraba, incluido
 * un telefono antiguo con aviso.
 */
export async function addWaIdToCustomer(
  phones: CustomerPhoneRepository,
  change: WaIdChange,
  scope: CustomerScope,
): Promise<'customer_not_found' | 'invalid_number' | { readonly numbers: readonly string[] }> {
  if (!(await phones.isAlive(change.customerId, scope))) return 'customer_not_found';

  const links = await phones.listAliveLinks(change.customerId, scope);
  if (links.some((link) => phoneMatchesWaId(link.e164, change.waId))) return { numbers: [] };

  const parsed = parseWaIdPhone(change.waId);
  if (parsed === null) return 'invalid_number';

  const isMain = !links.some((link) => link.main);
  await phones.addLink(change.customerId, parsed.e164, isMain, change.now, scope);
  if (isMain) {
    await phones.writeMainMirror(
      change.customerId,
      {
        phone: formatPhoneInternational(parsed.e164),
        phoneCountry: parsed.country,
        phoneE164: parsed.e164,
        phoneIssue: null,
      },
      change.actorId,
      change.now,
      scope,
    );
  }
  return { numbers: [parsed.e164] };
}

/** Quita del cliente todos los telefonos que coinciden con el contacto. Si uno era el principal,
 *  el cliente se queda sin principal: ningun secundario ocupa su lugar. */
export async function removeWaIdFromCustomer(
  phones: CustomerPhoneRepository,
  change: WaIdChange,
  scope: CustomerScope,
): Promise<{ readonly numbers: readonly string[] }> {
  const links = await phones.listAliveLinks(change.customerId, scope);
  const matching = links.filter((link) => phoneMatchesWaId(link.e164, change.waId));
  if (matching.length === 0) return { numbers: [] };

  await phones.removeLinks(
    matching.map((link) => link.linkId),
    change.now,
    scope,
  );
  if (matching.some((link) => link.main)) {
    await phones.writeMainMirror(change.customerId, null, change.actorId, change.now, scope);
  }
  return { numbers: matching.map((link) => link.e164) };
}

export function ownersOfWaId(
  phones: CustomerPhoneRepository,
  waId: string,
  scope: CustomerScope,
): Promise<readonly string[]> {
  return phones.findAliveOwners(waId, scope);
}

export type CustomerPhoneLinksDeps = { readonly phones: CustomerPhoneRepository };

/** Servicio que `clientes` ofrece a otros modulos. Recibe la empresa como cadena: `CustomerScope`
 *  es interno del modulo. */
export type CustomerPhoneLinksService = {
  addWaId(
    customerId: string,
    waId: string,
    actorId: string,
    now: Date,
    companyId: string,
  ): Promise<'customer_not_found' | 'invalid_number' | { readonly numbers: readonly string[] }>;
  removeWaId(
    customerId: string,
    waId: string,
    actorId: string,
    now: Date,
    companyId: string,
  ): Promise<{ readonly numbers: readonly string[] }>;
  ownersOf(waId: string, companyId: string): Promise<readonly string[]>;
};

export function createCustomerPhoneLinks(deps: CustomerPhoneLinksDeps): CustomerPhoneLinksService {
  return {
    addWaId: (customerId, waId, actorId, now, companyId) =>
      addWaIdToCustomer(deps.phones, { customerId, waId, actorId, now }, { companyId }),
    removeWaId: (customerId, waId, actorId, now, companyId) =>
      removeWaIdFromCustomer(deps.phones, { customerId, waId, actorId, now }, { companyId }),
    ownersOf: (waId, companyId) => ownersOfWaId(deps.phones, waId, { companyId }),
  };
}
