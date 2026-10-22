import type { CustomerScope } from '../domain/customer-scope';
import type { LegacyPhonePlan } from '../domain/legacy-phone-backfill';

/**
 * `converted`: pendientes que quedaron con numero. `reconverted`: las que estaban en `duplicate` y
 * quedaron con numero. `invalid`: las de cualquiera de las dos que quedaron en `invalid_format`.
 */
export type LegacyPhoneCompanyResult = {
  readonly converted: number;
  readonly invalid: number;
  readonly reconverted: number;
};

/**
 * Candidata = cliente vivo con `phone`, sin `phone_e164`, y con `phone_issue` nulo o `duplicate`.
 * Ninguna escritura deja una fila asi, por eso una segunda pasada no encuentra nada.
 */
export interface LegacyPhoneRepository {
  /** Lee las candidatas de la empresa, aplica `plan`, escribe solo las columnas del telefono y crea
   *  el vinculo principal de cada fila que quedo con numero, todo en una transaccion. */
  processCompany(plan: LegacyPhonePlan, scope: CustomerScope): Promise<LegacyPhoneCompanyResult>;
}
