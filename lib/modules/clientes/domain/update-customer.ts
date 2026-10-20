import { CUSTOMER_MODIFY_PERMISSION, requirePermission, type Actor } from './actor';
import { isCustomerId } from './customer-id';
import { phoneIssueReason, updateCustomerSchema } from './customer-input';
import { syncMainPhone } from './customer-phone-links';
import { normalizeCustomerText } from './customer-text';
import type { CustomerScope } from './customer-scope';
import { CustomerNotFoundError, inputError } from './errors';

import type { NewCustomerPhone } from './customer-view';

import type { CustomerUnitOfWork } from '../ports/customer-unit-of-work';

export type UpdateCustomerDeps = {
  readonly unitOfWork: CustomerUnitOfWork;
  readonly now?: () => Date;
};

/**
 * Edicion de cliente: reemplazo completo de los datos de negocio, no parche campo a campo. Un id
 * sin forma de uuid se rechaza como no encontrado, sin llegar al puerto: no hay razon de negocio
 * para distinguirlo de un id ajeno o inexistente.
 */
export function createUpdateCustomer(
  deps: UpdateCustomerDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function updateCustomer(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<void> {
    requirePermission(actor, CUSTOMER_MODIFY_PERMISSION);

    const scope: CustomerScope = { companyId: actor.companyId };

    if (!isCustomerId(id)) throw new CustomerNotFoundError();

    const parsed = updateCustomerSchema.safeParse(input);
    if (!parsed.success) throw inputError(phoneIssueReason(parsed.error));

    const { phone, phoneCountry, phoneE164, phoneIssue, ...rest } = parsed.data;
    // Sin numero no se sabe aqui si la fila tiene un telefono antiguo que conservar: lo decide el
    // adaptador con la fila bloqueada.
    const phoneWrite: NewCustomerPhone =
      phoneE164 === null ? { kind: 'keep_legacy_or_clear' } : { phone, phoneCountry, phoneE164, phoneIssue };

    const at = now();
    const data = {
      ...rest,
      phone: phoneWrite,
      firstNamesNormalized: normalizeCustomerText(rest.firstNames),
      lastNamesNormalized: normalizeCustomerText(rest.lastNames),
      cityNormalized: normalizeCustomerText(rest.city),
    };

    await deps.unitOfWork.run(async ({ customers, phones, whatsappLinks }) => {
      const result = await customers.updateAlive(id, data, actor.id, at, scope);
      // Inexistente, dado de baja o de otra empresa son el mismo caso para el dominio.
      if (result === 'not_found') throw new CustomerNotFoundError();
      // El numero que quedo en la fila y no el de la entrada: con el numero vacio, un telefono
      // antiguo con aviso se conserva y no tiene principal que quitar.
      const numbers = await syncMainPhone(phones, id, result.after, at, scope);
      await whatsappLinks.refresh(numbers, scope.companyId);
    });
  };
}
