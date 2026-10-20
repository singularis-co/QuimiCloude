import { CUSTOMER_MODIFY_PERMISSION, requirePermission, type Actor } from './actor';
import { createCustomerSchema, phoneIssueReason } from './customer-input';
import { syncMainPhone } from './customer-phone-links';
import { normalizeCustomerText } from './customer-text';
import type { CustomerScope } from './customer-scope';
import { inputError } from './errors';

import type { CustomerUnitOfWork } from '../ports/customer-unit-of-work';

export type CreateCustomerDeps = {
  readonly unitOfWork: CustomerUnitOfWork;
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
    requirePermission(actor, CUSTOMER_MODIFY_PERMISSION);

    // La empresa sale del ACTOR y jamas de la entrada.
    const scope: CustomerScope = { companyId: actor.companyId };

    const parsed = createCustomerSchema.safeParse(input);
    if (!parsed.success) throw inputError(phoneIssueReason(parsed.error));

    const { phone, phoneCountry, phoneE164, phoneIssue, ...rest } = parsed.data;
    const at = now();
    // Las tres formas normalizadas se calculan aqui, con la unica funcion del modulo, y viajan
    // emparejadas con su dato.
    const data = {
      ...rest,
      phone: { phone, phoneCountry, phoneE164, phoneIssue },
      firstNamesNormalized: normalizeCustomerText(rest.firstNames),
      lastNamesNormalized: normalizeCustomerText(rest.lastNames),
      cityNormalized: normalizeCustomerText(rest.city),
    };

    return deps.unitOfWork.run(async ({ customers, phones, whatsappLinks }) => {
      const { id } = await customers.create(data, actor.id, at, scope);
      const numbers = await syncMainPhone(phones, id, phoneE164, at, scope);
      await whatsappLinks.refresh(numbers, scope.companyId);
      return { id };
    });
  };
}
