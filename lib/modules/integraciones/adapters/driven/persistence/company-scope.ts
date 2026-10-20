import type { Prisma } from '@prisma/client';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';

/**
 * La única definición de «de la empresa» del módulo: toda consulta o escritura de sus tablas
 * la toma de aquí, para que no haya copias que diverjan.
 */
function companyScope(scope: IntegracionesScope): { companyId: string } {
  return { companyId: scope.companyId };
}

export function whatsappConnectionCompanyScope(
  scope: IntegracionesScope,
): Prisma.WhatsappConnectionWhereInput {
  return companyScope(scope);
}

export function whatsappContactCompanyScope(scope: IntegracionesScope): Prisma.WhatsappContactWhereInput {
  return companyScope(scope);
}

export function whatsappMessageCompanyScope(scope: IntegracionesScope): Prisma.WhatsappMessageWhereInput {
  return companyScope(scope);
}

export function whatsappTemplateCompanyScope(scope: IntegracionesScope): Prisma.WhatsappTemplateWhereInput {
  return companyScope(scope);
}

/** Para el `data` de un `create`: en un `WhereInput` la columna es opcional y admite un filtro. */
export function companyScopeColumns(scope: IntegracionesScope): { readonly companyId: string } {
  return companyScope(scope);
}
