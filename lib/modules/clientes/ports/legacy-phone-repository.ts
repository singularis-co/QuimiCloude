import type { CustomerScope } from '../domain/customer-scope';
import type { LegacyPhonePlan } from '../domain/legacy-phone-backfill';

export type LegacyPhoneCompanyResult = {
  readonly converted: number;
  readonly invalid: number;
  readonly duplicate: number;
};

/**
 * Pendiente = cliente vivo con `phone` y sin `phone_e164` ni `phone_issue`. Ningun guardado deja
 * una fila asi, por eso una segunda pasada no encuentra nada.
 */
export interface LegacyPhoneRepository {
  /** Lee los pendientes de la empresa y los `phone_e164` ya tomados, aplica `plan` y escribe solo
   *  las tres columnas del telefono, todo en una transaccion. */
  processCompany(plan: LegacyPhonePlan, scope: CustomerScope): Promise<LegacyPhoneCompanyResult>;
}
