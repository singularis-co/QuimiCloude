import { requirePermission, type Actor } from './actor';
import { createCustomerSchema, phoneIssueReason } from './customer-input';
import { normalizeCustomerText } from './customer-text';
import type { CustomerScope } from './customer-scope';
import { inputError } from './errors';

import type { CustomerWriteRepository } from '../ports/customer-write-repository';

export type CreateCustomerDeps = {
  readonly customers: CustomerWriteRepository;
  /** Reloj inyectable, `() => new Date()` por defecto: el dominio no lee ningun reloj global. */
  readonly now?: () => Date;
};

/**
 * Alta de cliente. `requirePermission` es la primera linea, antes de `zod` y antes de tocar
 * el puerto: sin autorizacion no hay validacion que valga.
 */
export function createCreateCustomer(
  deps: CreateCustomerDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<{ id: string }> {
  const now = deps.now ?? (() => new Date());

  return async function createCustomer(
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<{ id: string }> {
    requirePermission(actor, 'clientes.modificar');

    // La empresa sale del ACTOR y jamas de la entrada.
    const scope: CustomerScope = { companyId: actor.companyId };

    const parsed = createCustomerSchema.safeParse(input);
    if (!parsed.success) throw inputError(phoneIssueReason(parsed.error));

    const { phone, phoneCountry, phoneE164, phoneIssue, ...rest } = parsed.data;
    // Las tres formas normalizadas se calculan aqui, con la unica funcion del modulo, y viajan
    // emparejadas con su dato.
    return deps.customers.create(
      {
        ...rest,
        phone: { phone, phoneCountry, phoneE164, phoneIssue },
        firstNamesNormalized: normalizeCustomerText(rest.firstNames),
        lastNamesNormalized: normalizeCustomerText(rest.lastNames),
        cityNormalized: normalizeCustomerText(rest.city),
      },
      actor.id,
      now(),
      scope,
    );
  };
}
